import { Scene, GameObjects, Input } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { FontConfig } from '../config/FontConfig';
import {
    InventoryComponent, ItemDefinition, InventoryItem,
    SettingsComponent, UIStateComponent, EquipmentSlotComponent,
    AttributeComponent, HotbarComponent, BankComponent
} from '../ecs/Component';

type SlotSource = 'player' | 'container' | 'equipment' | 'hotbar';

interface SlotRef {
    source: SlotSource;
    index: number;
}

/**
 * 背包 / 容器 / 装备栏 UI；
 * 同时承担屏幕左下角“快捷栏”格子的拖放命中（背包打开时）。
 * heldItem 状态私有；'hotbar' 槽位的位置通过 uistate.hotbarSlotRects 读取。
 */
export class InventoryUISystem extends System {
    private isOpen = false;
    private isContainerMode = false;
    private previousBDown = false;
    private bKey: Input.Keyboard.Key | null = null;

    private heldItem: InventoryItem | null = null;
    private heldFromSlot = -1;
    private heldSource: 'player' | 'container' | 'hotbar' = 'player';
    private targetEntity: Entity | null = null;
    private containerEntity: Entity | null = null;

    private panel!: GameObjects.Graphics;
    private itemGraphics!: GameObjects.Graphics;
    private itemSprites: GameObjects.Sprite[] = [];
    private heldSprite!: GameObjects.Sprite;
    private quantityTexts: GameObjects.Text[] = [];
    private heldText!: GameObjects.Text;

    // 装备栏标签
    private equipLabel!: GameObjects.Text;
    private equipSlotLabels: GameObjects.Text[] = [];

    // 银行余额显示
    private bankBalanceBg!: GameObjects.Graphics;
    private bankBalanceText!: GameObjects.Text;

    private readonly COLS = 5;
    private readonly ROWS = 4;
    private readonly BASE_CELL_SIZE = 40;
    private readonly BASE_GAP = 4;
    private readonly BASE_PADDING = 12;

    private uiScale = 1.0;

    constructor(scene: Scene) {
        super(scene);
        this.bKey = scene.input.keyboard?.addKey('B') ?? null;
        this.initUI();
        scene.input.on('pointerdown', this.onPointerDown, this);
    }

    private initUI(): void {
        this.panel = this.scene.add.graphics();
        this.panel.setDepth(1000);
        this.panel.visible = false;

        this.itemGraphics = this.scene.add.graphics();
        this.itemGraphics.setDepth(1001);
        this.itemGraphics.visible = false;

        // 道具图标精灵池：玩家(20) + 容器(20) + 装备(3) = 43；够用即可
        for (let i = 0; i < 44; i++) {
            const sprite = this.scene.add.sprite(0, 0, 'item_notfind');
            sprite.setDepth(1001);
            sprite.setOrigin(0, 0);
            sprite.visible = false;
            this.itemSprites.push(sprite);
        }

        // 手持物品图标
        this.heldSprite = this.scene.add.sprite(0, 0, 'item_notfind');
        this.heldSprite.setDepth(1002);
        this.heldSprite.setOrigin(0, 0);
        this.heldSprite.visible = false;

        // 最多 40 个数量文字
        for (let i = 0; i < 40; i++) {
            const text = this.createText(0, 0, '', {
                fontSize: FontConfig.small.size, color: '#ffffff',
                fontFamily: FontConfig.small.family,
            });
            text.setDepth(1001);
            text.setOrigin(1, 1);
            text.visible = false;
            this.quantityTexts.push(text);
        }

        this.heldText = this.createText(0, 0, '', {
            fontSize: FontConfig.small.size, color: '#ffffff',
            fontFamily: FontConfig.small.family,
        });
        this.heldText.setDepth(1002);
        this.heldText.setOrigin(1, 1);
        this.heldText.visible = false;

        // 装备栏标签
        this.equipLabel = this.createText(0, 0, '装备栏', {
            fontSize: FontConfig.small.size, color: '#8888aa',
            fontFamily: FontConfig.small.family,
        });
        this.equipLabel.setDepth(1001);
        this.equipLabel.setOrigin(0, 0);
        this.equipLabel.visible = false;

        const equipNames = ['武器', '护甲', '头盔'];
        for (const name of equipNames) {
            const text = this.createText(0, 0, name, {
                fontSize: FontConfig.tiny.size, color: '#666688',
                fontFamily: FontConfig.small.family,
            });
            text.setDepth(1001);
            text.setOrigin(0.5, 0);
            text.visible = false;
            this.equipSlotLabels.push(text);
        }

        // 银行余额显示
        this.bankBalanceBg = this.scene.add.graphics();
        this.bankBalanceBg.setDepth(1000);
        this.bankBalanceBg.visible = false;

        this.bankBalanceText = this.createText(0, 0, '', {
            fontSize: FontConfig.small.size, color: '#ffcc44',
            fontFamily: FontConfig.small.family,
        });
        this.bankBalanceText.setDepth(1001);
        this.bankBalanceText.setOrigin(0.5, 0.5);
        this.bankBalanceText.visible = false;
    }

    update(entities: Entity[], _delta: number): void {
        const uistate = this.getUIState(entities);
        this.lastUIState = uistate ?? null;

        // 容器模式：外部打开（E 键交互）
        if (uistate?.containerOpen && !this.isOpen) {
            const player = entities.find(e => e.hasComponent('inventory') && e.hasComponent('player'));
            const container = uistate.activeContainer;
            if (player && container) {
                this.isOpen = true;
                this.isContainerMode = true;
                this.targetEntity = player;
                this.containerEntity = container;
            }
        }

        // 外部关闭请求（ESC 关闭全部 UI）
        if (uistate && !uistate.inventoryOpen && !uistate.containerOpen && this.isOpen) {
            this.returnHeldItem();
            this.isOpen = false;
            this.isContainerMode = false;
            this.targetEntity = null;
            this.containerEntity = null;
        }

        const bDown = this.bKey?.isDown ?? false;
        if (bDown && !this.previousBDown) {
            if (uistate?.containerOpen) {
                // 容器模式下按 B 关闭全部
                uistate.containerOpen = false;
                uistate.inventoryOpen = false;
                uistate.activeContainer = null;
            } else {
                this.toggleUI(entities);
            }
        }
        this.previousBDown = bDown;

        // 同步 UI 打开状态到全局组件
        if (uistate && !this.isContainerMode) {
            uistate.inventoryOpen = this.isOpen;
        }

        // 读取全局 UI 缩放
        const settingsEntity = entities.find(e => e.hasComponent('settings'));
        const settings = settingsEntity?.getComponent<SettingsComponent>('settings');
        this.uiScale = settings?.uiScale ?? 1.0;

        if (!this.isOpen || !this.targetEntity) {
            this.hideAll();
            return;
        }

        this.renderGrid();
        this.renderHeldItem();
        this.checkHoverAndSetTooltip(uistate);
    }

    private getUIState(entities: Entity[]): UIStateComponent | undefined {
        const entity = entities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<UIStateComponent>('uistate');
    }

    /** 将屏幕像素坐标转换为世界坐标 */
    private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
        const cam = this.scene.cameras.main;
        const worldPoint = cam.getWorldPoint(screenX, screenY);
        return { x: worldPoint.x, y: worldPoint.y };
    }

    private toggleUI(entities: Entity[]): void {
        if (this.isOpen) {
            this.returnHeldItem();
            this.isOpen = false;
            this.isContainerMode = false;
            this.targetEntity = null;
            this.containerEntity = null;
        } else {
            const entity = entities.find(e => e.hasComponent('inventory') && e.hasComponent('player'));
            if (entity) {
                this.isOpen = true;
                this.isContainerMode = false;
                this.targetEntity = entity;
            }
        }
    }

    /** 根据 heldSource 取出对应可写槽位数组 */
    private getItemsArrayBySource(source: 'player' | 'container' | 'hotbar'): (InventoryItem | null)[] | null {
        if (source === 'player') {
            return this.targetEntity?.getComponent<InventoryComponent>('inventory')?.items ?? null;
        }
        if (source === 'container') {
            return this.containerEntity?.getComponent<InventoryComponent>('inventory')?.items ?? null;
        }
        // hotbar
        return this.targetEntity?.getComponent<HotbarComponent>('hotbar')?.slots ?? null;
    }

    private returnHeldItem(): void {
        if (!this.heldItem) return;

        const items = this.getItemsArrayBySource(this.heldSource);
        if (!items) {
            this.clearHeld();
            return;
        }

        if (this.heldFromSlot >= 0 && this.heldFromSlot < items.length && items[this.heldFromSlot] === null) {
            items[this.heldFromSlot] = { ...this.heldItem };
        } else {
            // 优先回到原源；若满则尝试塞入玩家库存
            const emptySlot = items.findIndex(item => item === null);
            if (emptySlot >= 0) {
                items[emptySlot] = { ...this.heldItem };
            } else if (this.heldSource !== 'player') {
                const playerItems = this.targetEntity?.getComponent<InventoryComponent>('inventory')?.items;
                const pSlot = playerItems?.findIndex(item => item === null) ?? -1;
                if (playerItems && pSlot >= 0) {
                    playerItems[pSlot] = { ...this.heldItem };
                }
            }
        }
        this.clearHeld();
    }

    // ============================================================
    // 渲染
    // ============================================================

    private getPanelLayout(): {
        leftGridX: number;
        rightGridX: number;
        gridY: number;
        panelW: number;
        leftPanelH: number;
        rightPanelH: number;
        equipGridX: number | null;
        equipGridY: number | null;
    } {
        const cam = this.scene.cameras.main;
        const scale = this.uiScale;

        const cellSize = this.BASE_CELL_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const padding = this.BASE_PADDING * scale;

        const panelW = this.COLS * cellSize + (this.COLS - 1) * gap + padding * 2;
        const leftPanelH = this.ROWS * cellSize + (this.ROWS - 1) * gap + padding * 2;

        const cx = cam.midPoint.x;
        const cy = cam.midPoint.y;

        let leftGridX: number;
        let rightGridX: number;
        let gridY: number;
        let rightPanelH = leftPanelH;
        let equipGridX: number | null = null;
        let equipGridY: number | null = null;

        if (this.isContainerMode && this.containerEntity) {
            const gapBetween = 24 * scale;
            const totalW = panelW * 2 + gapBetween;
            leftGridX = cx - totalW / 2;
            rightGridX = leftGridX + panelW + gapBetween;
            gridY = cy - leftPanelH / 2;
        } else {
            // 普通背包模式：左侧背包 + 右侧装备栏
            const gapBetween = 24 * scale;
            const labelH = 14 * scale;
            const equipGridH = cellSize;
            const rightContentH = equipGridH + labelH;
            const rightH = rightContentH + padding * 2;
            const maxH = Math.max(leftPanelH, rightH);
            const totalW = panelW * 2 + gapBetween;
            leftGridX = cx - totalW / 2;
            rightGridX = leftGridX + panelW + gapBetween;
            gridY = cy - maxH / 2;

            rightPanelH = maxH;

            // 装备栏位置（垂直居中于右面板）
            equipGridY = gridY + (rightPanelH - equipGridH) / 2;
            const equipSlotTotalW = 3 * cellSize + 2 * (gap * 3);
            equipGridX = rightGridX + (panelW - padding * 2 - equipSlotTotalW) / 2;
        }

        return {
            leftGridX, rightGridX, gridY,
            panelW, leftPanelH, rightPanelH,
            equipGridX, equipGridY,
        };
    }

    private renderGrid(): void {
        if (!this.targetEntity) return;

        const playerInventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        const containerInventory = this.containerEntity?.getComponent<InventoryComponent>('inventory');
        const equipComp = this.targetEntity.getComponent<EquipmentSlotComponent>('equipment_slots');

        const scale = this.uiScale;
        const {
            leftGridX, rightGridX, gridY,
            panelW, leftPanelH, rightPanelH,
            equipGridX, equipGridY,
        } = this.getPanelLayout();
        const padding = this.BASE_PADDING * scale;

        // 绘制背景面板
        this.panel.clear();

        // 玩家面板背景（左侧）
        this.panel.fillStyle(0x1a1a2e, 0.95);
        this.panel.fillRoundedRect(leftGridX - padding, gridY - padding, panelW, leftPanelH, 8 * scale);
        this.panel.lineStyle(2 * scale, 0x444466, 1);
        this.panel.strokeRoundedRect(leftGridX - padding, gridY - padding, panelW, leftPanelH, 8 * scale);

        // 银行余额显示（背包面板下方，独立小块）
        const bankComp = this.targetEntity?.getComponent<BankComponent>('bank');
        const bankGold = bankComp?.gold ?? 0;
        const balanceText = `银行: ${bankGold} 金币`;
        const bgW = 88 * scale;
        const bgH = 18 * scale;
        const bgX = leftGridX - padding + 6 * scale;
        const bgY = gridY - padding + leftPanelH + 6 * scale;
        this.bankBalanceBg.clear();
        this.bankBalanceBg.fillStyle(0x2a2a3e, 0.9);
        this.bankBalanceBg.fillRoundedRect(bgX, bgY, bgW, bgH, 4 * scale);
        this.bankBalanceBg.lineStyle(Math.max(1, scale), 0xaa8844, 1);
        this.bankBalanceBg.strokeRoundedRect(bgX, bgY, bgW, bgH, 4 * scale);
        this.bankBalanceBg.visible = true;
        this.bankBalanceText.setPosition(bgX + bgW / 2, bgY + bgH / 2);
        this.bankBalanceText.setScale(scale);
        this.bankBalanceText.setText(balanceText);
        this.bankBalanceText.visible = true;

        if (this.isContainerMode) {
            // 容器面板背景（右侧）
            this.panel.fillStyle(0x1a1a2e, 0.95);
            this.panel.fillRoundedRect(rightGridX - padding, gridY - padding, panelW, leftPanelH, 8 * scale);
            this.panel.lineStyle(2 * scale, 0x444466, 1);
            this.panel.strokeRoundedRect(rightGridX - padding, gridY - padding, panelW, leftPanelH, 8 * scale);
        } else {
            // 装备栏面板背景（右侧）
            this.panel.fillStyle(0x1a1a2e, 0.95);
            this.panel.fillRoundedRect(rightGridX - padding, gridY - padding, panelW, rightPanelH, 8 * scale);
            this.panel.lineStyle(2 * scale, 0x444466, 1);
            this.panel.strokeRoundedRect(rightGridX - padding, gridY - padding, panelW, rightPanelH, 8 * scale);
        }

        // 绘制格子和物品
        this.itemGraphics.clear();
        let textIdx = 0;
        let spriteIdx = 0;

        // 玩家格子（左侧）
        for (let i = 0; i < playerInventory.capacity; i++) {
            ({ textIdx, spriteIdx } = this.renderSlot(leftGridX, gridY, i, playerInventory.items, scale, textIdx, spriteIdx, 0x555577));
        }

        // 容器格子（右侧）
        if (this.isContainerMode && containerInventory) {
            for (let i = 0; i < containerInventory.capacity; i++) {
                ({ textIdx, spriteIdx } = this.renderSlot(rightGridX, gridY, i, containerInventory.items, scale, textIdx, spriteIdx, 0x555577));
            }
        }

        // 装备栏格子（右侧）
        if (!this.isContainerMode && equipGridX !== null && equipGridY !== null) {
            const equipItems: (InventoryItem | null)[] = [
                equipComp?.weapon ?? null,
                equipComp?.armor ?? null,
                equipComp?.helmet ?? null,
            ];
            const cellSize = this.BASE_CELL_SIZE * scale;
            const gap = this.BASE_GAP * scale;
            const equipGap = gap * 3;
            for (let i = 0; i < equipItems.length; i++) {
                const slotX = equipGridX + i * (cellSize + equipGap);
                ({ textIdx, spriteIdx } = this.renderEquipSlot(slotX, equipGridY, equipItems[i], scale, textIdx, spriteIdx));
            }

            // 装备栏标签
            this.equipLabel.setPosition(rightGridX, gridY + padding / 2);
            this.equipLabel.setScale(scale);
            this.equipLabel.visible = true;

            for (let i = 0; i < this.equipSlotLabels.length; i++) {
                const slotX = equipGridX + i * (cellSize + equipGap) + cellSize / 2;
                this.equipSlotLabels[i].setPosition(slotX, equipGridY + cellSize + 2 * scale);
                this.equipSlotLabels[i].setScale(scale);
                this.equipSlotLabels[i].visible = true;
            }
        } else {
            this.equipLabel.visible = false;
            for (const text of this.equipSlotLabels) {
                text.visible = false;
            }
        }

        for (let i = textIdx; i < this.quantityTexts.length; i++) {
            this.quantityTexts[i].visible = false;
        }
        for (let i = spriteIdx; i < this.itemSprites.length; i++) {
            this.itemSprites[i].visible = false;
        }

        this.panel.visible = true;
        this.itemGraphics.visible = true;
    }

    /** 在 (gridX,gridY) 起点绘制一行/格子（按 COLS 排版）— 用于玩家与容器 */
    private renderSlot(
        gridX: number,
        gridY: number,
        index: number,
        items: (InventoryItem | null)[],
        scale: number,
        textIdx: number,
        spriteIdx: number,
        borderColor: number
    ): { textIdx: number; spriteIdx: number } {
        const cellSize = this.BASE_CELL_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const slotX = gridX + (index % this.COLS) * (cellSize + gap);
        const slotY = gridY + Math.floor(index / this.COLS) * (cellSize + gap);

        // 格子背景
        this.itemGraphics.fillStyle(0x2a2a3e, 1);
        this.itemGraphics.fillRect(slotX, slotY, cellSize, cellSize);

        // 格子边框
        this.itemGraphics.lineStyle(Math.max(1, scale), borderColor, 1);
        this.itemGraphics.strokeRect(slotX, slotY, cellSize, cellSize);

        // 物品图标
        const item = items[index];
        if (item) {
            if (spriteIdx < this.itemSprites.length) {
                const sprite = this.itemSprites[spriteIdx];
                const iconSize = cellSize - 8 * scale;
                sprite.setTexture(this.getItemTextureKey(item.itemId));
                sprite.setDisplaySize(iconSize, iconSize);
                sprite.setPosition(slotX + 4 * scale, slotY + 4 * scale);
                sprite.setAlpha(1);
                sprite.visible = true;
                spriteIdx++;
            }

            if (textIdx < this.quantityTexts.length) {
                const text = this.quantityTexts[textIdx];
                text.setPosition(slotX + cellSize - 3 * scale, slotY + cellSize - 2 * scale);
                text.setScale(scale);
                text.setText(item.quantity > 1 ? String(item.quantity) : '');
                text.visible = true;
                textIdx++;
            }
        }

        return { textIdx, spriteIdx };
    }

    private renderEquipSlot(
        gridX: number,
        gridY: number,
        item: InventoryItem | null,
        scale: number,
        textIdx: number,
        spriteIdx: number
    ): { textIdx: number; spriteIdx: number } {
        const cellSize = this.BASE_CELL_SIZE * scale;

        // 格子背景
        this.itemGraphics.fillStyle(0x2a2a3e, 1);
        this.itemGraphics.fillRect(gridX, gridY, cellSize, cellSize);

        // 装备栏边框（蓝色突出）
        this.itemGraphics.lineStyle(Math.max(1, scale), 0x6677aa, 1);
        this.itemGraphics.strokeRect(gridX, gridY, cellSize, cellSize);

        if (item) {
            if (spriteIdx < this.itemSprites.length) {
                const sprite = this.itemSprites[spriteIdx];
                const iconSize = cellSize - 8 * scale;
                sprite.setTexture(this.getItemTextureKey(item.itemId));
                sprite.setDisplaySize(iconSize, iconSize);
                sprite.setPosition(gridX + 4 * scale, gridY + 4 * scale);
                sprite.setAlpha(1);
                sprite.visible = true;
                spriteIdx++;
            }

            if (textIdx < this.quantityTexts.length) {
                const text = this.quantityTexts[textIdx];
                text.setPosition(gridX + cellSize - 3 * scale, gridY + cellSize - 2 * scale);
                text.setScale(scale);
                text.setText(item.quantity > 1 ? String(item.quantity) : '');
                text.visible = true;
                textIdx++;
            }
        }

        return { textIdx, spriteIdx };
    }

    private renderHeldItem(): void {
        if (!this.heldItem) {
            this.heldSprite.visible = false;
            this.heldText.visible = false;
            return;
        }

        const pointer = this.scene.input.activePointer;
        const { x: worldX, y: worldY } = this.screenToWorld(pointer.x, pointer.y);
        const scale = this.uiScale;
        const cellSize = this.BASE_CELL_SIZE * scale;
        const size = cellSize - 8 * scale;
        const hx = worldX - size / 2;
        const hy = worldY - size / 2;

        // 手持物品图标
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

    private hideAll(): void {
        this.panel.visible = false;
        this.itemGraphics.visible = false;
        for (const sprite of this.itemSprites) {
            sprite.visible = false;
        }
        this.heldSprite.visible = false;
        this.heldText.visible = false;
        for (const text of this.quantityTexts) {
            text.visible = false;
        }
        this.equipLabel.visible = false;
        for (const text of this.equipSlotLabels) {
            text.visible = false;
        }
        this.bankBalanceBg.visible = false;
        this.bankBalanceText.visible = false;
    }

    // ============================================================
    // 点击交互
    // ============================================================

    private onPointerDown(pointer: Input.Pointer): void {
        if (!this.isOpen || !this.targetEntity) return;

        const slotInfo = this.getSlotAt(pointer.x, pointer.y);
        if (!slotInfo) return;

        // 装备栏点击
        if (slotInfo.source === 'equipment') {
            this.handleEquipClick(slotInfo.index);
            return;
        }

        const { source, index } = slotInfo;
        const items = this.getItemsArrayBySource(source);
        if (!items) return;

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;

        if (pointer.button === 0) {
            this.handleLeftClick(items, itemsMap, index, source);
        } else if (pointer.button === 2) {
            this.handleRightClick(items, itemsMap, index, source);
        }
    }

    private getSlotAt(screenX: number, screenY: number): SlotRef | null {
        const { x: worldX, y: worldY } = this.screenToWorld(screenX, screenY);
        const scale = this.uiScale;
        const cellSize = this.BASE_CELL_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const {
            leftGridX, rightGridX, gridY,
            equipGridX, equipGridY,
        } = this.getPanelLayout();

        // 检测玩家面板（左侧）
        const playerRelX = worldX - leftGridX;
        const playerRelY = worldY - gridY;
        for (let i = 0; i < this.COLS * this.ROWS; i++) {
            const slotX = (i % this.COLS) * (cellSize + gap);
            const slotY = Math.floor(i / this.COLS) * (cellSize + gap);
            if (
                playerRelX >= slotX && playerRelX < slotX + cellSize &&
                playerRelY >= slotY && playerRelY < slotY + cellSize
            ) {
                return { source: 'player', index: i };
            }
        }

        if (this.isContainerMode) {
            // 检测容器面板（右侧）
            const containerRelX = worldX - rightGridX;
            const containerRelY = worldY - gridY;
            for (let i = 0; i < this.COLS * this.ROWS; i++) {
                const slotX = (i % this.COLS) * (cellSize + gap);
                const slotY = Math.floor(i / this.COLS) * (cellSize + gap);
                if (
                    containerRelX >= slotX && containerRelX < slotX + cellSize &&
                    containerRelY >= slotY && containerRelY < slotY + cellSize
                ) {
                    return { source: 'container', index: i };
                }
            }
        }

        if (!this.isContainerMode && equipGridX !== null && equipGridY !== null) {
            // 检测装备栏
            const equipGap = gap * 3;
            for (let i = 0; i < 3; i++) {
                const slotX = equipGridX + i * (cellSize + equipGap);
                const slotY = equipGridY;
                if (
                    worldX >= slotX && worldX < slotX + cellSize &&
                    worldY >= slotY && worldY < slotY + cellSize
                ) {
                    return { source: 'equipment', index: i };
                }
            }
        }

        // 检测屏幕左下角的快捷栏（背包打开时支持拖放）
        const uistate = this.lastUIState;
        if (uistate && uistate.hotbarSlotRects.length > 0) {
            for (let i = 0; i < uistate.hotbarSlotRects.length; i++) {
                const r = uistate.hotbarSlotRects[i];
                if (
                    worldX >= r.x && worldX < r.x + r.size &&
                    worldY >= r.y && worldY < r.y + r.size
                ) {
                    return { source: 'hotbar', index: i };
                }
            }
        }

        return null;
    }

    private lastUIState: UIStateComponent | null = null;

    private handleLeftClick(
        items: (InventoryItem | null)[],
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number,
        source: 'player' | 'container' | 'hotbar'
    ): void {
        const slotItem = items[slot];

        if (!this.heldItem) {
            if (slotItem) {
                this.heldItem = { ...slotItem };
                this.heldFromSlot = slot;
                this.heldSource = source;
                items[slot] = null;
            }
            return;
        }

        // 放入 hotbar 限制：仅消耗品 / usable 物品
        if (source === 'hotbar' && !this.canEnterHotbar(this.heldItem.itemId, itemsMap)) {
            const def = itemsMap?.[this.heldItem.itemId];
            console.log(`[Hotbar] ${def?.name ?? this.heldItem.itemId} 无法放入快捷栏（仅消耗品或可使用物品）`);
            return;
        }

        if (!slotItem) {
            items[slot] = { ...this.heldItem };
            this.clearHeld();
        } else if (slotItem.itemId === this.heldItem.itemId) {
            this.tryStackAll(items, itemsMap, slot, source);
        } else {
            this.swapWithSlot(items, slot, source);
        }
    }

    private handleRightClick(
        items: (InventoryItem | null)[],
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number,
        source: 'player' | 'container' | 'hotbar'
    ): void {
        const slotItem = items[slot];
        if (!this.heldItem) {
            if (slotItem) {
                const half = Math.ceil(slotItem.quantity / 2);
                this.heldItem = { itemId: slotItem.itemId, quantity: half };
                this.heldFromSlot = slot;
                this.heldSource = source;
                slotItem.quantity -= half;
                if (slotItem.quantity <= 0) {
                    items[slot] = null;
                }
            }
            return;
        }

        // 放入 hotbar 限制
        if (source === 'hotbar' && !this.canEnterHotbar(this.heldItem.itemId, itemsMap)) {
            const def = itemsMap?.[this.heldItem.itemId];
            console.log(`[Hotbar] ${def?.name ?? this.heldItem.itemId} 无法放入快捷栏（仅消耗品或可使用物品）`);
            return;
        }

        if (!slotItem) {
            this.placeOne(items, slot);
        } else if (slotItem.itemId === this.heldItem.itemId) {
            this.tryStackOne(items, itemsMap, slot, source);
        } else {
            this.swapWithSlot(items, slot, source);
        }
    }

    private canEnterHotbar(
        itemId: string,
        itemsMap: Record<string, ItemDefinition> | undefined
    ): boolean {
        const def = itemsMap?.[itemId];
        if (!def) return false;
        return def.type === 'consumable' || def.usable === true;
    }

    private tryStackAll(
        items: (InventoryItem | null)[],
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number,
        source: 'player' | 'container' | 'hotbar'
    ): void {
        if (!this.heldItem) return;
        const def = itemsMap?.[this.heldItem.itemId];
        const slotItem = items[slot];
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
        this.swapWithSlot(items, slot, source);
    }

    private tryStackOne(
        items: (InventoryItem | null)[],
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number,
        source: 'player' | 'container' | 'hotbar'
    ): void {
        if (!this.heldItem) return;
        const def = itemsMap?.[this.heldItem.itemId];
        const slotItem = items[slot];
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
        this.swapWithSlot(items, slot, source);
    }

    private placeOne(items: (InventoryItem | null)[], slot: number): void {
        if (!this.heldItem) return;
        items[slot] = { itemId: this.heldItem.itemId, quantity: 1 };
        this.heldItem.quantity--;
        if (this.heldItem.quantity <= 0) {
            this.clearHeld();
        }
    }

    private swapWithSlot(
        items: (InventoryItem | null)[],
        slot: number,
        source: 'player' | 'container' | 'hotbar'
    ): void {
        if (!this.heldItem) return;
        const temp = items[slot];
        items[slot] = { ...this.heldItem };
        if (temp) {
            this.heldItem = { ...temp };
            this.heldFromSlot = slot;
            this.heldSource = source;
        } else {
            this.clearHeld();
        }
    }

    // ============================================================
    // 装备栏交互
    // ============================================================

    private handleEquipClick(slotIndex: number): void {
        if (!this.targetEntity) return;

        const equipComp = this.targetEntity.getComponent<EquipmentSlotComponent>('equipment_slots')!;
        const playerInventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        const attrComp = this.targetEntity.getComponent<AttributeComponent>('attribute');
        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;

        const slotNames: ('weapon' | 'armor' | 'helmet')[] = ['weapon', 'armor', 'helmet'];
        const slotName = slotNames[slotIndex];

        // 情况1：手持物品，尝试装备
        if (this.heldItem) {
            const def = itemsMap?.[this.heldItem.itemId];
            if (!def || def.type !== 'equipment' || def.equipment?.slot !== slotName) {
                console.log(`[Equip] ${def?.name ?? this.heldItem.itemId} 无法装备到 ${this.slotLabel(slotName)} 槽`);
                return;
            }

            // 如果槽位已有装备，先卸下回背包
            const oldEquip = equipComp[slotName];
            if (oldEquip) {
                const emptySlot = playerInventory.items.findIndex(item => item === null);
                if (emptySlot < 0) {
                    console.log('[Equip] 背包已满，无法更换装备');
                    return;
                }
                playerInventory.items[emptySlot] = oldEquip;
                this.logUnequip(oldEquip.itemId, itemsMap);
            }

            // 装备新物品
            equipComp[slotName] = { ...this.heldItem };
            this.logEquip(this.heldItem.itemId, itemsMap);
            this.clearHeld();

            // 重新计算属性
            this.recalculateAttributes(equipComp, attrComp, itemsMap);
            return;
        }

        // 情况2：没有手持物品，尝试卸下
        const currentEquip = equipComp[slotName];
        if (currentEquip) {
            // 把装备拿在手中（玩家可以拖到背包空位放下）
            this.heldItem = { ...currentEquip };
            this.heldFromSlot = -1;
            this.heldSource = 'player';
            equipComp[slotName] = null;

            this.logUnequip(currentEquip.itemId, itemsMap);
            this.recalculateAttributes(equipComp, attrComp, itemsMap);
        }
    }

    private recalculateAttributes(
        equipComp: EquipmentSlotComponent,
        attrComp: AttributeComponent | undefined,
        itemsMap: Record<string, ItemDefinition> | undefined
    ): void {
        if (!attrComp) return;

        let equipAttack = 0;
        let equipDefense = 0;

        const slots: ('weapon' | 'armor' | 'helmet')[] = ['weapon', 'armor', 'helmet'];
        for (const slot of slots) {
            const item = equipComp[slot];
            if (item) {
                const def = itemsMap?.[item.itemId];
                if (def?.equipment) {
                    equipAttack += def.equipment.attack ?? 0;
                    equipDefense += def.equipment.defense ?? 0;
                }
            }
        }

        const oldAttack = attrComp.attack;
        const oldDefense = attrComp.defense;
        attrComp.attack = attrComp.baseAttack + equipAttack;
        attrComp.defense = attrComp.baseDefense + equipDefense;

        if (oldAttack !== attrComp.attack || oldDefense !== attrComp.defense) {
            console.log(`[Attribute] 攻击: ${oldAttack} → ${attrComp.attack}, 防御: ${oldDefense} → ${attrComp.defense}`);
        }
    }

    private logEquip(itemId: string, itemsMap: Record<string, ItemDefinition> | undefined): void {
        const def = itemsMap?.[itemId];
        if (def) {
            const attrs: string[] = [];
            if (def.equipment?.attack) attrs.push(`攻击+${def.equipment.attack}`);
            if (def.equipment?.defense) attrs.push(`防御+${def.equipment.defense}`);
            console.log(`[Equip] 装备 ${def.name}${attrs.length > 0 ? ' (' + attrs.join(', ') + ')' : ''}`);
        } else {
            console.log(`[Equip] 装备 ${itemId}`);
        }
    }

    private logUnequip(itemId: string, itemsMap: Record<string, ItemDefinition> | undefined): void {
        const def = itemsMap?.[itemId];
        if (def) {
            console.log(`[Equip] 卸下 ${def.name}`);
        } else {
            console.log(`[Equip] 卸下 ${itemId}`);
        }
    }

    // ============================================================
    // Tooltip
    // ============================================================

    private checkHoverAndSetTooltip(uistate: UIStateComponent | undefined): void {
        if (!uistate || !this.targetEntity) return;

        const pointer = this.scene.input.activePointer;
        const slotInfo = this.getSlotAt(pointer.x, pointer.y);
        if (!slotInfo) return;

        const { source, index } = slotInfo;

        let item: InventoryItem | null = null;
        if (source === 'player') {
            const inventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
            item = inventory.items[index];
        } else if (source === 'container') {
            const inventory = this.containerEntity?.getComponent<InventoryComponent>('inventory');
            item = inventory?.items[index] ?? null;
        } else if (source === 'equipment') {
            const equipComp = this.targetEntity.getComponent<EquipmentSlotComponent>('equipment_slots');
            const equipItems = [equipComp?.weapon, equipComp?.armor, equipComp?.helmet];
            item = equipItems[index] ?? null;
        } else if (source === 'hotbar') {
            const hotbarComp = this.targetEntity.getComponent<HotbarComponent>('hotbar');
            item = hotbarComp?.slots[index] ?? null;
        }

        if (!item) return;

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;
        const def = itemsMap?.[item.itemId];
        if (!def) return;

        const { x: worldX, y: worldY } = this.screenToWorld(pointer.x, pointer.y);

        let stats = '';
        if (def.type === 'equipment' && def.equipment) {
            const attrs: string[] = [];
            if (def.equipment.attack) attrs.push(`攻击 +${def.equipment.attack}`);
            if (def.equipment.defense) attrs.push(`防御 +${def.equipment.defense}`);
            attrs.push(`部位: ${this.slotLabel(def.equipment.slot)}`);
            stats = attrs.join('  ');
        } else if (def.type === 'consumable' && def.useEffect) {
            const eff = def.useEffect;
            if (eff.type === 'apply_buff' && eff.duration !== undefined) {
                stats = `持续 ${Math.floor(eff.duration / 1000)} 秒`;
            } else if (eff.value !== undefined) {
                stats = `效果: ${this.effectLabel(eff.type)} ${eff.value}`;
            }
        } else if (def.value) {
            stats = `价值: ${def.value} 金币`;
        }

        uistate.tooltip = {
            x: worldX,
            y: worldY,
            name: def.name,
            nameColor: this.getRarityColor(def.type),
            typeText: this.typeLabel(def.type),
            description: def.description,
            stats,
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

    private slotLabel(slot: string): string {
        switch (slot) {
            case 'weapon': return '武器';
            case 'armor': return '护甲';
            case 'helmet': return '头盔';
            default: return slot;
        }
    }

    private effectLabel(effect: string): string {
        switch (effect) {
            case 'heal': return '恢复生命';
            default: return effect;
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

    private clearHeld(): void {
        this.heldItem = null;
        this.heldFromSlot = -1;
        this.heldSource = 'player';
    }
}
