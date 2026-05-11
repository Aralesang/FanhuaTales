import { Scene, GameObjects } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { FontConfig } from '../config/FontConfig';
import {
    UIStateComponent, HotbarComponent, InventoryComponent,
    HealthComponent, ItemDefinition
} from '../ecs/Component';

export class HotbarUISystem extends System {
    // UI 元素
    private panel!: GameObjects.Graphics;
    private slotGraphics!: GameObjects.Graphics;
    private slotTexts: GameObjects.Text[] = [];
    private slotQtyTexts: GameObjects.Text[] = [];
    private dirLabels: GameObjects.Text[] = [];

    private readonly SLOT_SIZE = 40;
    private readonly OFFSET = 50;
    private readonly DIR_NAMES = ['上', '下', '左', '右'];

    private readonly itemColors: Record<string, number> = {
        health_potion: 0xcc3333,
        iron_sword: 0x888888,
        gold_coin: 0xffcc00,
        leather_armor: 0x8b5a2b,
        wooden_helmet: 0xa0522d,
    };

    constructor(scene: Scene) {
        super(scene);
        this.initUI();
    }

    private initUI(): void {
        this.panel = this.scene.add.graphics();
        this.panel.setDepth(15000);
        this.panel.visible = false;

        this.slotGraphics = this.scene.add.graphics();
        this.slotGraphics.setDepth(15001);
        this.slotGraphics.visible = false;

        for (let i = 0; i < 4; i++) {
            const text = this.createText(0, 0, '', {
                fontSize: FontConfig.small.size,
                color: '#ffffff',
                fontFamily: FontConfig.small.family,
            });
            text.setDepth(15002);
            text.setOrigin(0.5, 0.5);
            text.visible = false;
            this.slotTexts.push(text);

            // 数量文本（图标右下角，与其他格子一致）
            const qtyText = this.createText(0, 0, '', {
                fontSize: FontConfig.small.size,
                color: '#ffffff',
                fontFamily: FontConfig.small.family,
            });
            qtyText.setDepth(15003);
            qtyText.setOrigin(1, 1);
            qtyText.visible = false;
            this.slotQtyTexts.push(qtyText);

            const label = this.createText(0, 0, this.DIR_NAMES[i], {
                fontSize: FontConfig.tiny.size,
                color: '#8888aa',
                fontFamily: FontConfig.small.family,
            });
            label.setDepth(15002);
            label.setOrigin(0.5, 0.5);
            label.visible = false;
            this.dirLabels.push(label);
        }
    }

    update(entities: Entity[], _delta: number): void {
        const uistate = this.getUIState(entities);
        if (!uistate) return;

        // 处理快捷栏使用请求
        if (uistate.hotbarUseIndex !== null) {
            this.useHotbarItem(entities, uistate.hotbarUseIndex);
            uistate.hotbarUseIndex = null;
        }

        if (!uistate.hotbarOpen) {
            this.hideAll();
            return;
        }

        this.renderHotbar(entities);
    }

    private renderHotbar(entities: Entity[]): void {
        const player = entities.find(e => e.hasComponent('player'));
        if (!player) {
            this.hideAll();
            return;
        }

        const hotbar = player.getComponent<HotbarComponent>('hotbar');
        const inventory = player.getComponent<InventoryComponent>('inventory');
        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;

        const cam = this.scene.cameras.main;
        const cx = cam.midPoint.x;
        const cy = cam.midPoint.y;

        const positions = [
            { x: cx, y: cy - this.OFFSET },           // 上
            { x: cx, y: cy + this.OFFSET },           // 下
            { x: cx - this.OFFSET, y: cy },           // 左
            { x: cx + this.OFFSET, y: cy },           // 右
        ];

        const half = this.SLOT_SIZE / 2;

        // 绘制半透明遮罩（弱化背景）
        this.panel.clear();
        this.panel.fillStyle(0x000000, 0.3);
        const camW = cam.width / (cam.zoom || 1);
        const camH = cam.height / (cam.zoom || 1);
        this.panel.fillRect(cx - camW / 2, cy - camH / 2, camW, camH);
        this.panel.visible = true;

        // 绘制四个槽位
        this.slotGraphics.clear();
        for (let i = 0; i < 4; i++) {
            const pos = positions[i];
            const itemId = hotbar?.slots[i] ?? null;

            // 槽位背景
            this.slotGraphics.fillStyle(0x1a1a2e, 0.95);
            this.slotGraphics.fillRoundedRect(pos.x - half, pos.y - half, this.SLOT_SIZE, this.SLOT_SIZE, 4);

            // 槽位边框
            this.slotGraphics.lineStyle(2, 0x444466, 1);
            this.slotGraphics.strokeRoundedRect(pos.x - half, pos.y - half, this.SLOT_SIZE, this.SLOT_SIZE, 4);

            // 方向标签（槽位上方）
            this.dirLabels[i].setPosition(pos.x, pos.y - half - 8);
            this.dirLabels[i].visible = true;

            if (itemId) {
                const def = itemsMap?.[itemId];
                // 计算背包中该物品的总数量
                const totalQty = inventory
                    ? inventory.items.reduce((sum, item) => sum + (item?.itemId === itemId ? item.quantity : 0), 0)
                    : 0;
                const hasStock = totalQty > 0;

                // 物品颜色方块（数量为0时变灰半透明）
                const color = this.itemColors[itemId] ?? 0xaaaaaa;
                this.slotGraphics.fillStyle(color, hasStock ? 1 : 0.3);
                this.slotGraphics.fillRect(pos.x - half + 4, pos.y - half + 4, this.SLOT_SIZE - 8, this.SLOT_SIZE - 8);

                // 物品名称（下方）
                const nameText = def?.name ?? itemId;
                this.slotTexts[i].setPosition(pos.x, pos.y + half + 10);
                this.slotTexts[i].setText(nameText);
                this.slotTexts[i].setColor(hasStock ? '#ffffff' : '#777777');
                this.slotTexts[i].visible = true;

                // 数量（图标右下角，与其他格子一致）
                this.slotQtyTexts[i].setPosition(pos.x + half - 4, pos.y + half - 4);
                this.slotQtyTexts[i].setText(String(totalQty));
                this.slotQtyTexts[i].setColor(hasStock ? '#ffffff' : '#777777');
                this.slotQtyTexts[i].visible = true;
            } else {
                // 空槽位
                this.slotTexts[i].setPosition(pos.x, pos.y);
                this.slotTexts[i].setText('空');
                this.slotTexts[i].setColor('#555577');
                this.slotTexts[i].visible = true;

                this.slotQtyTexts[i].visible = false;
            }
        }
        this.slotGraphics.visible = true;
    }

    private useHotbarItem(entities: Entity[], slotIndex: number): void {
        const player = entities.find(e => e.hasComponent('player'));
        if (!player) return;

        const hotbar = player.getComponent<HotbarComponent>('hotbar');
        const inventory = player.getComponent<InventoryComponent>('inventory');
        if (!hotbar || !inventory) return;

        const itemId = hotbar.slots[slotIndex];
        if (!itemId) {
            console.log(`[Hotbar] ${this.DIR_NAMES[slotIndex]} 槽位为空`);
            return;
        }

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;
        const def = itemsMap?.[itemId];
        if (!def) {
            console.log(`[Hotbar] 未知道具: ${itemId}`);
            return;
        }

        // 在库存中查找该道具
        const slot = inventory.items.findIndex(item => item?.itemId === itemId);
        if (slot < 0) {
            console.log(`[Hotbar] 背包中找不到 ${def.name}，快捷栏保留记录`);
            return;
        }

        const item = inventory.items[slot]!;

        // 使用消耗品
        if (def.type === 'consumable' && def.useEffect) {
            this.applyEffect(player, def.useEffect.type, def.useEffect.value);
            item.quantity--;
            console.log(`[Hotbar] 使用 ${def.name}，剩余 ${item.quantity} 个`);

            if (item.quantity <= 0) {
                inventory.items[slot] = null;
                console.log(`[Hotbar] ${def.name} 已耗尽，库存清空但快捷栏仍保留记录`);
            }
        } else {
            console.log(`[Hotbar] ${def.name} 无法直接使用`);
        }
    }

    private applyEffect(entity: Entity, effectType: string, value: number): void {
        switch (effectType) {
            case 'heal': {
                const health = entity.getComponent<HealthComponent>('health');
                if (health) {
                    const oldHp = health.hp;
                    health.hp = Math.min(health.maxHp, health.hp + value);
                    console.log(`[Effect] 恢复 ${health.hp - oldHp} 点生命 (${oldHp} → ${health.hp})`);
                }
                break;
            }
            default:
                console.log(`[Effect] 未知效果类型: ${effectType}`);
        }
    }

    private hideAll(): void {
        this.panel.visible = false;
        this.slotGraphics.visible = false;
        for (const text of this.slotTexts) {
            text.visible = false;
        }
        for (const text of this.slotQtyTexts) {
            text.visible = false;
        }
        for (const label of this.dirLabels) {
            label.visible = false;
        }
    }

    private getUIState(entities: Entity[]): UIStateComponent | undefined {
        const entity = entities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<UIStateComponent>('uistate');
    }
}
