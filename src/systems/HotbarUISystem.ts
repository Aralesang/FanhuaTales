import { Scene, GameObjects, Input } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { FontConfig } from '../config/FontConfig';
import {
    UIStateComponent, HotbarComponent, HealthComponent,
    ItemDefinition, SettingsComponent, InventoryItem, BuffComponent, NeedsComponent
} from '../ecs/Component';

/**
 * 快捷栏 UI：固定显示在屏幕左下角，4 个槽位水平排列。
 * 槽位独立存储道具（同 InventoryComponent.items，但容量 4）。
 *
 * 鼠标拖放（背包关闭时独立处理）：
 *   - 左键：拾取 / 放下 / 交换 / 堆叠
 *   - 右键：拆半 / 放 1 个 / 堆叠 1 个
 *   - 放入限制：仅消耗品或 usable 物品
 *
 * 数字键 1/2/3/4：使用对应槽位的消耗品（仅当所有主 UI 关闭时）。
 */
export class HotbarUISystem extends System {
    private slotGraphics!: GameObjects.Graphics;
    private slotSprites: GameObjects.Sprite[] = [];
    private slotQtyTexts: GameObjects.Text[] = [];
    private slotNumLabels: GameObjects.Text[] = [];

    // 手持拖放（背包关闭时独立使用）
    private heldItem: InventoryItem | null = null;
    private heldSprite!: GameObjects.Sprite;
    private heldText!: GameObjects.Text;

    private numKeys: (Input.Keyboard.Key | null)[] = [];
    private prevNumDown: boolean[] = [false, false, false, false];

    // 基础尺寸（base 像素，会乘以 uiScale 转为世界像素）
    private readonly BASE_SLOT_SIZE = 40;
    private readonly BASE_GAP = 4;
    private readonly BASE_MARGIN = 8;

    private uiScale = 1.0;
    private lastEntities: Entity[] = [];

    constructor(scene: Scene) {
        super(scene);
        this.initUI();
        this.initKeys();
        scene.input.on('pointerdown', this.onPointerDown, this);
    }

    private initUI(): void {
        // 层级策略：快捷栏始终显示，但需在背包 UI（1000+）和 Tooltip（10000）之下，
        // 在游戏世界（~50）之上。统一使用 60-64 区间。
        this.slotGraphics = this.scene.add.graphics();
        this.slotGraphics.setDepth(60);

        for (let i = 0; i < 4; i++) {
            const sprite = this.scene.add.sprite(0, 0, 'item_notfind');
            sprite.setDepth(61);
            sprite.setOrigin(0, 0);
            sprite.visible = false;
            this.slotSprites.push(sprite);

            const qty = this.createText(0, 0, '', {
                fontSize: FontConfig.small.size,
                color: '#ffffff',
                fontFamily: FontConfig.small.family,
            });
            qty.setDepth(62);
            qty.setOrigin(1, 1);
            qty.visible = false;
            this.slotQtyTexts.push(qty);

            const num = this.createText(0, 0, String(i + 1), {
                fontSize: FontConfig.tiny.size,
                color: '#aaaaaa',
                fontFamily: FontConfig.small.family,
            });
            num.setDepth(62);
            num.setOrigin(0, 0);
            num.visible = false;
            this.slotNumLabels.push(num);
        }

        // 手持图标（背包关闭时拖放）
        this.heldSprite = this.scene.add.sprite(0, 0, 'item_notfind');
        this.heldSprite.setDepth(63);
        this.heldSprite.setOrigin(0, 0);
        this.heldSprite.visible = false;

        this.heldText = this.createText(0, 0, '', {
            fontSize: FontConfig.small.size,
            color: '#ffffff',
            fontFamily: FontConfig.small.family,
        });
        this.heldText.setDepth(64);
        this.heldText.setOrigin(1, 1);
        this.heldText.visible = false;
    }

    private initKeys(): void {
        const kb = this.scene.input.keyboard;
        if (!kb) {
            this.numKeys = [null, null, null, null];
            return;
        }
        this.numKeys = [
            kb.addKey(Input.Keyboard.KeyCodes.ONE),
            kb.addKey(Input.Keyboard.KeyCodes.TWO),
            kb.addKey(Input.Keyboard.KeyCodes.THREE),
            kb.addKey(Input.Keyboard.KeyCodes.FOUR),
        ];
    }

    update(entities: Entity[], _delta: number): void {
        this.lastEntities = entities;

        const settingsEntity = entities.find(e => e.hasComponent('settings'));
        const settings = settingsEntity?.getComponent<SettingsComponent>('settings');
        this.uiScale = settings?.uiScale ?? 1.0;

        const uistate = this.getUIState(entities);

        // 更新鼠标 hover 状态（供 InputSystem 跳过攻击触发）
        if (uistate) {
            uistate.pointerInHotbar = this.isPointerInHotbar();
        }

        // 渲染同时把槽位矩形写入 uistate（供 InventoryUI 拖放命中）
        this.renderHotbar(entities, uistate);
        this.renderHeldItem();
        this.checkHoverAndSetTooltip(entities, uistate);

        // 数字键触发：仅在所有主 UI 关闭时生效
        const anyUIOpen = uistate?.inventoryOpen || uistate?.containerOpen || uistate?.storeOpen || uistate?.bankOpen;
        if (!anyUIOpen) {
            this.processNumKeys(entities);
        } else {
            this.prevNumDown = [false, false, false, false];
        }
    }

    // ============================================================
    // 数字键使用
    // ============================================================

    private processNumKeys(entities: Entity[]): void {
        for (let i = 0; i < 4; i++) {
            const key = this.numKeys[i];
            const isDown = key?.isDown ?? false;
            if (isDown && !this.prevNumDown[i]) {
                this.useHotbarItem(entities, i);
            }
            this.prevNumDown[i] = isDown;
        }
    }

    private useHotbarItem(entities: Entity[], slotIndex: number): void {
        const player = entities.find(e => e.hasComponent('player'));
        if (!player) return;

        const hotbar = player.getComponent<HotbarComponent>('hotbar');
        if (!hotbar) return;

        const slot = hotbar.slots[slotIndex];
        if (!slot) {
            console.log(`[Hotbar] 槽位 ${slotIndex + 1} 为空`);
            return;
        }

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;
        const def = itemsMap?.[slot.itemId];
        if (!def) {
            console.log(`[Hotbar] 未知道具: ${slot.itemId}`);
            return;
        }

        if (def.type === 'consumable' && def.useEffect) {
            this.applyEffect(player, def.useEffect);
            slot.quantity--;
            console.log(`[Hotbar] 使用 ${def.name}，剩余 ${slot.quantity} 个`);
            if (slot.quantity <= 0) {
                hotbar.slots[slotIndex] = null;
                console.log(`[Hotbar] ${def.name} 已耗尽`);
            }
        } else {
            console.log(`[Hotbar] ${def.name} 无法直接使用`);
        }
    }

    private applyEffect(entity: Entity, effect: NonNullable<ItemDefinition['useEffect']>): void {
        switch (effect.type) {
            case 'heal': {
                if (effect.value === undefined) return;
                const health = entity.getComponent<HealthComponent>('health');
                if (health) {
                    const oldHp = health.hp;
                    health.hp = Math.min(health.maxHp, health.hp + effect.value);
                    console.log(`[Effect] 恢复 ${health.hp - oldHp} 点生命 (${oldHp} → ${health.hp})`);
                }
                break;
            }
            case 'apply_buff': {
                if (!effect.buffId || effect.duration === undefined) {
                    console.warn('[Effect] apply_buff 缺少 buffId 或 duration');
                    return;
                }
                const buffComp = entity.getComponent<BuffComponent>('buff');
                if (!buffComp) {
                    console.warn('[Effect] 目标实体没有 BuffComponent，无法施加 buff');
                    return;
                }
                buffComp.pendingBuffs.push({ buffId: effect.buffId, duration: effect.duration });
                console.log(`[Effect] 申请 buff: ${effect.buffId} (${effect.duration}ms)`);
                break;
            }
            case 'restore_needs': {
                if (effect.value === undefined || !effect.needsType) {
                    console.warn('[Effect] restore_needs 缺少 value 或 needsType');
                    return;
                }
                const needs = entity.getComponent<NeedsComponent>('needs');
                if (!needs) {
                    console.warn('[Effect] 目标实体没有 NeedsComponent');
                    return;
                }
                if (effect.needsType === 'hunger') {
                    needs.pendingDeltas.push({ hunger: effect.value });
                } else if (effect.needsType === 'thirst') {
                    needs.pendingDeltas.push({ thirst: effect.value });
                }
                console.log(`[Effect] 申请恢复 ${effect.needsType} +${effect.value}`);
                break;
            }
            default:
                console.log(`[Effect] 未知效果类型: ${effect.type}`);
        }
    }

    // ============================================================
    // 渲染
    // ============================================================

    private renderHotbar(entities: Entity[], uistate: UIStateComponent | undefined): void {
        const player = entities.find(e => e.hasComponent('player'));
        if (!player) return;

        const hotbar = player.getComponent<HotbarComponent>('hotbar');
        const { slotPositions, slotSize } = this.getLayout();
        const scale = this.uiScale;

        if (uistate) {
            uistate.hotbarSlotRects = slotPositions.map(p => ({ x: p.x, y: p.y, size: slotSize }));
        }

        this.slotGraphics.clear();
        for (let i = 0; i < 4; i++) {
            const { x, y } = slotPositions[i];
            this.slotGraphics.fillStyle(0x1a1a2e, 0.85);
            this.slotGraphics.fillRoundedRect(x, y, slotSize, slotSize, 4 * scale);
            this.slotGraphics.lineStyle(Math.max(1, scale), 0xaa8844, 1);
            this.slotGraphics.strokeRoundedRect(x, y, slotSize, slotSize, 4 * scale);
        }

        for (let i = 0; i < 4; i++) {
            const { x, y } = slotPositions[i];
            const slot = hotbar?.slots[i] ?? null;

            const num = this.slotNumLabels[i];
            num.setPosition(x + 3 * scale, y + 2 * scale);
            num.setScale(scale);
            num.visible = true;

            if (slot) {
                const sprite = this.slotSprites[i];
                const iconSize = slotSize - 8 * scale;
                sprite.setTexture(this.getItemTextureKey(slot.itemId));
                sprite.setDisplaySize(iconSize, iconSize);
                sprite.setPosition(x + 4 * scale, y + 4 * scale);
                sprite.setAlpha(1);
                sprite.visible = true;

                const qty = this.slotQtyTexts[i];
                qty.setPosition(x + slotSize - 3 * scale, y + slotSize - 2 * scale);
                qty.setScale(scale);
                qty.setText(slot.quantity > 1 ? String(slot.quantity) : '');
                qty.setColor('#ffffff');
                qty.visible = slot.quantity > 1;
            } else {
                this.slotSprites[i].visible = false;
                this.slotQtyTexts[i].visible = false;
            }
        }
    }

    private renderHeldItem(): void {
        if (!this.heldItem) {
            this.heldSprite.visible = false;
            this.heldText.visible = false;
            return;
        }

        const pointer = this.scene.input.activePointer;
        const cam = this.scene.cameras.main;
        const { x: worldX, y: worldY } = cam.getWorldPoint(pointer.x, pointer.y);
        const scale = this.uiScale;
        const slotSize = this.BASE_SLOT_SIZE * scale;
        const size = slotSize - 8 * scale;
        const hx = worldX - size / 2;
        const hy = worldY - size / 2;

        this.heldSprite.setTexture(this.getItemTextureKey(this.heldItem.itemId));
        this.heldSprite.setDisplaySize(size, size);
        this.heldSprite.setPosition(hx, hy);
        this.heldSprite.setAlpha(0.9);
        this.heldSprite.visible = true;

        if (this.heldItem.quantity > 1) {
            this.heldText.setPosition(worldX + size / 2 - 2 * scale, worldY + size / 2 - 2 * scale);
            this.heldText.setScale(scale);
            this.heldText.setText(String(this.heldItem.quantity));
            this.heldText.visible = true;
        } else {
            this.heldText.visible = false;
        }
    }

    private getLayout(): { slotPositions: { x: number; y: number }[]; slotSize: number } {
        const scale = this.uiScale;
        const slotSize = this.BASE_SLOT_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const margin = this.BASE_MARGIN * scale;

        const cam = this.scene.cameras.main;
        const zoom = cam.zoom || 1;
        const viewLeft = cam.midPoint.x - cam.width / 2 / zoom;
        const viewBottom = cam.midPoint.y + cam.height / 2 / zoom;

        const baseY = viewBottom - margin - slotSize;
        const slotPositions: { x: number; y: number }[] = [];
        for (let i = 0; i < 4; i++) {
            slotPositions.push({
                x: viewLeft + margin + i * (slotSize + gap),
                y: baseY,
            });
        }
        return { slotPositions, slotSize };
    }

    private isPointerInHotbar(): boolean {
        const pointer = this.scene.input.activePointer;
        const cam = this.scene.cameras.main;
        const world = cam.getWorldPoint(pointer.x, pointer.y);
        const { slotPositions, slotSize } = this.getLayout();
        for (const pos of slotPositions) {
            if (world.x >= pos.x && world.x < pos.x + slotSize &&
                world.y >= pos.y && world.y < pos.y + slotSize) {
                return true;
            }
        }
        return false;
    }

    // ============================================================
    // 鼠标拖放（背包关闭时）
    // ============================================================

    private onPointerDown(pointer: Input.Pointer): void {
        // 任何主 UI 打开时由对应 UI 处理，避免冲突
        const uistate = this.getUIStateFromCache();
        if (uistate?.inventoryOpen || uistate?.containerOpen || uistate?.storeOpen || uistate?.bankOpen) {
            return;
        }

        const slotIndex = this.getSlotIndexAt(pointer.x, pointer.y);
        if (slotIndex === null) return;

        const player = this.getPlayerEntityFromCache();
        if (!player) return;

        const hotbar = player.getComponent<HotbarComponent>('hotbar');
        if (!hotbar) return;

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;

        if (pointer.button === 0) {
            this.handleLeftClick(hotbar.slots, itemsMap, slotIndex);
        } else if (pointer.button === 2) {
            this.handleRightClick(hotbar.slots, itemsMap, slotIndex);
        }
    }

    private handleLeftClick(
        slots: (InventoryItem | null)[],
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number
    ): void {
        const slotItem = slots[slot];

        if (!this.heldItem) {
            if (slotItem) {
                this.heldItem = { ...slotItem };
                slots[slot] = null;
            }
            return;
        }

        if (!this.canEnterHotbar(this.heldItem.itemId, itemsMap)) {
            const def = itemsMap?.[this.heldItem.itemId];
            console.log(`[Hotbar] ${def?.name ?? this.heldItem.itemId} 无法放入快捷栏（仅消耗品或可使用物品）`);
            return;
        }

        if (!slotItem) {
            slots[slot] = { ...this.heldItem };
            this.clearHeld();
        } else if (slotItem.itemId === this.heldItem.itemId) {
            this.tryStackAll(slots, itemsMap, slot);
        } else {
            this.swapWithSlot(slots, slot);
        }
    }

    private handleRightClick(
        slots: (InventoryItem | null)[],
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number
    ): void {
        const slotItem = slots[slot];

        if (!this.heldItem) {
            if (slotItem) {
                const half = Math.ceil(slotItem.quantity / 2);
                this.heldItem = { itemId: slotItem.itemId, quantity: half };
                slotItem.quantity -= half;
                if (slotItem.quantity <= 0) {
                    slots[slot] = null;
                }
            }
            return;
        }

        if (!this.canEnterHotbar(this.heldItem.itemId, itemsMap)) {
            const def = itemsMap?.[this.heldItem.itemId];
            console.log(`[Hotbar] ${def?.name ?? this.heldItem.itemId} 无法放入快捷栏（仅消耗品或可使用物品）`);
            return;
        }

        if (!slotItem) {
            this.placeOne(slots, slot);
        } else if (slotItem.itemId === this.heldItem.itemId) {
            this.tryStackOne(slots, itemsMap, slot);
        } else {
            this.swapWithSlot(slots, slot);
        }
    }

    private canEnterHotbar(itemId: string, itemsMap: Record<string, ItemDefinition> | undefined): boolean {
        const def = itemsMap?.[itemId];
        if (!def) return false;
        return def.type === 'consumable' || def.usable === true;
    }

    private tryStackAll(
        slots: (InventoryItem | null)[],
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number
    ): void {
        if (!this.heldItem) return;
        const def = itemsMap?.[this.heldItem.itemId];
        const slotItem = slots[slot];
        if (!slotItem || slotItem.itemId !== this.heldItem.itemId) return;
        if (def?.stackable) {
            const space = def.maxStack - slotItem.quantity;
            if (space > 0) {
                const transfer = Math.min(this.heldItem.quantity, space);
                slotItem.quantity += transfer;
                this.heldItem.quantity -= transfer;
                if (this.heldItem.quantity <= 0) {
                    this.clearHeld();
                }
                return;
            }
        }
        this.swapWithSlot(slots, slot);
    }

    private tryStackOne(
        slots: (InventoryItem | null)[],
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number
    ): void {
        if (!this.heldItem) return;
        const def = itemsMap?.[this.heldItem.itemId];
        const slotItem = slots[slot];
        if (!slotItem || slotItem.itemId !== this.heldItem.itemId) return;
        if (def?.stackable) {
            const space = def.maxStack - slotItem.quantity;
            if (space > 0) {
                slotItem.quantity++;
                this.heldItem.quantity--;
                if (this.heldItem.quantity <= 0) {
                    this.clearHeld();
                }
                return;
            }
        }
        this.swapWithSlot(slots, slot);
    }

    private placeOne(slots: (InventoryItem | null)[], slot: number): void {
        if (!this.heldItem) return;
        slots[slot] = { itemId: this.heldItem.itemId, quantity: 1 };
        this.heldItem.quantity--;
        if (this.heldItem.quantity <= 0) {
            this.clearHeld();
        }
    }

    private swapWithSlot(slots: (InventoryItem | null)[], slot: number): void {
        if (!this.heldItem) return;
        const temp = slots[slot];
        slots[slot] = { ...this.heldItem };
        if (temp) {
            this.heldItem = { ...temp };
        } else {
            this.clearHeld();
        }
    }

    private clearHeld(): void {
        this.heldItem = null;
    }

    private getSlotIndexAt(screenX: number, screenY: number): number | null {
        const cam = this.scene.cameras.main;
        const world = cam.getWorldPoint(screenX, screenY);
        const { slotPositions, slotSize } = this.getLayout();
        for (let i = 0; i < 4; i++) {
            const pos = slotPositions[i];
            if (world.x >= pos.x && world.x < pos.x + slotSize &&
                world.y >= pos.y && world.y < pos.y + slotSize) {
                return i;
            }
        }
        return null;
    }

    // ============================================================
    // Tooltip（通过 UIStateComponent 写入，由 TooltipSystem 统一渲染）
    // ============================================================

    private checkHoverAndSetTooltip(entities: Entity[], uistate: UIStateComponent | undefined): void {
        if (!uistate) return;

        const pointer = this.scene.input.activePointer;
        const slotIndex = this.getSlotIndexAt(pointer.x, pointer.y);
        if (slotIndex === null || this.heldItem) return;

        const player = entities.find(e => e.hasComponent('player'));
        const hotbar = player?.getComponent<HotbarComponent>('hotbar');
        const slot = hotbar?.slots[slotIndex] ?? null;
        if (!slot) return;

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;
        const def = itemsMap?.[slot.itemId];
        if (!def) return;

        const cam = this.scene.cameras.main;
        const world = cam.getWorldPoint(pointer.x, pointer.y);

        uistate.tooltip = {
            x: world.x,
            y: world.y,
            name: def.name,
            nameColor: this.getRarityColor(def.type),
            typeText: this.typeLabel(def.type),
            description: def.description,
        };
    }

    private typeLabel(type: string): string {
        switch (type) {
            case 'consumable': return '消耗品';
            case 'equipment': return '装备';
            case 'material': return '材料';
            default: return type;
        }
    }

    private getRarityColor(type: string): string {
        switch (type) {
            case 'equipment': return '#ffaa44';
            case 'consumable': return '#44aaff';
            case 'material': return '#aaaaaa';
            default: return '#ffffff';
        }
    }

    /** 使用最近一次 update 缓存的 entities 读取 uistate */
    private getUIStateFromCache(): UIStateComponent | undefined {
        const entity = this.lastEntities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<UIStateComponent>('uistate');
    }

    private getPlayerEntityFromCache(): Entity | undefined {
        return this.lastEntities.find(e => e.hasComponent('player'));
    }

    private getUIState(entities: Entity[]): UIStateComponent | undefined {
        const entity = entities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<UIStateComponent>('uistate');
    }
}
