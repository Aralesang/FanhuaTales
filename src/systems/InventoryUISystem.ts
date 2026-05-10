import { Scene, GameObjects, Input } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import {
    InventoryComponent, ItemDefinition, InventoryItem,
    SettingsComponent, UIStateComponent, EquipmentSlotComponent,
    AttributeComponent
} from '../ecs/Component';

interface SlotRef {
    source: 'player' | 'container' | 'equipment';
    index: number;
}

export class InventoryUISystem extends System {
    private isOpen = false;
    private isContainerMode = false;
    private previousBDown = false;
    private bKey: Input.Keyboard.Key | null = null;

    private heldItem: InventoryItem | null = null;
    private heldFromSlot = -1;
    private heldSource: 'player' | 'container' = 'player';
    private targetEntity: Entity | null = null;
    private containerEntity: Entity | null = null;

    private panel!: GameObjects.Graphics;
    private itemGraphics!: GameObjects.Graphics;
    private heldGraphics!: GameObjects.Graphics;
    private quantityTexts: GameObjects.Text[] = [];
    private heldText!: GameObjects.Text;

    // 装备栏标签
    private equipLabel!: GameObjects.Text;
    private equipSlotLabels: GameObjects.Text[] = [];

    // Tooltip 元素
    private tooltipPanel!: GameObjects.Graphics;
    private tooltipName!: GameObjects.Text;
    private tooltipType!: GameObjects.Text;
    private tooltipDesc!: GameObjects.Text;
    private tooltipStats!: GameObjects.Text;

    private readonly COLS = 5;
    private readonly ROWS = 4;
    private readonly BASE_CELL_SIZE = 40;
    private readonly BASE_GAP = 4;
    private readonly BASE_PADDING = 12;

    private uiScale = 1.0;
    private panelW = 0;
    private panelH = 0;

    private readonly itemColors: Record<string, number> = {
        health_potion: 0xcc3333,
        iron_sword: 0x888888,
        gold_coin: 0xffcc00,
        leather_armor: 0x8b5a2b,
        wooden_helmet: 0xa0522d,
    };

    constructor(scene: Scene) {
        super(scene);
        this.bKey = scene.input.keyboard?.addKey('B') ?? null;
        this.initUI();
        scene.input.on('pointerdown', this.onPointerDown, this);
    }

    private initUI(): void {
        this.panelW = this.COLS * this.BASE_CELL_SIZE + (this.COLS - 1) * this.BASE_GAP + this.BASE_PADDING * 2;
        this.panelH = this.ROWS * this.BASE_CELL_SIZE + (this.ROWS - 1) * this.BASE_GAP + this.BASE_PADDING * 2;

        this.panel = this.scene.add.graphics();
        this.panel.setDepth(1000);
        this.panel.visible = false;

        this.itemGraphics = this.scene.add.graphics();
        this.itemGraphics.setDepth(1001);
        this.itemGraphics.visible = false;

        this.heldGraphics = this.scene.add.graphics();
        this.heldGraphics.setDepth(1002);
        this.heldGraphics.visible = false;

        // 最多 40 个数量文字（20 玩家 + 20 容器 / 装备）
        for (let i = 0; i < 40; i++) {
            const text = this.scene.add.text(0, 0, '', {
                fontSize: '12px', color: '#ffffff',
                fontFamily: 'VonwaonBitmap12',
            });
            text.setDepth(1001);
            text.setOrigin(1, 1);
            text.visible = false;
            this.quantityTexts.push(text);
        }

        this.heldText = this.scene.add.text(0, 0, '', {
            fontSize: '12px', color: '#ffffff',
            fontFamily: 'VonwaonBitmap12',
        });
        this.heldText.setDepth(1002);
        this.heldText.setOrigin(1, 1);
        this.heldText.visible = false;

        // 装备栏标签
        this.equipLabel = this.scene.add.text(0, 0, '装备栏', {
            fontSize: '12px', color: '#8888aa',
            fontFamily: 'VonwaonBitmap12',
        });
        this.equipLabel.setDepth(1001);
        this.equipLabel.setOrigin(0, 0);
        this.equipLabel.visible = false;

        const equipNames = ['武器', '护甲', '头盔'];
        for (const name of equipNames) {
            const text = this.scene.add.text(0, 0, name, {
                fontSize: '10px', color: '#666688',
                fontFamily: 'VonwaonBitmap12',
            });
            text.setDepth(1001);
            text.setOrigin(0.5, 0);
            text.visible = false;
            this.equipSlotLabels.push(text);
        }

        // Tooltip（depth 高于血条 9998）
        this.tooltipPanel = this.scene.add.graphics();
        this.tooltipPanel.setDepth(10000);
        this.tooltipPanel.visible = false;

        this.tooltipName = this.scene.add.text(0, 0, '', {
            fontSize: '16px', color: '#ffffff',
            fontFamily: 'VonwaonBitmap16',
        });
        this.tooltipName.setDepth(10001);
        this.tooltipName.setOrigin(0, 0);
        this.tooltipName.visible = false;

        this.tooltipType = this.scene.add.text(0, 0, '', {
            fontSize: '12px', color: '#aaaaaa',
            fontFamily: 'VonwaonBitmap12',
        });
        this.tooltipType.setDepth(10001);
        this.tooltipType.setOrigin(0, 0);
        this.tooltipType.visible = false;

        this.tooltipDesc = this.scene.add.text(0, 0, '', {
            fontSize: '12px', color: '#cccccc',
            fontFamily: 'VonwaonBitmap12',
        });
        this.tooltipDesc.setDepth(10001);
        this.tooltipDesc.setOrigin(0, 0);
        this.tooltipDesc.visible = false;

        this.tooltipStats = this.scene.add.text(0, 0, '', {
            fontSize: '12px', color: '#88cc88',
            fontFamily: 'VonwaonBitmap12',
        });
        this.tooltipStats.setDepth(10001);
        this.tooltipStats.setOrigin(0, 0);
        this.tooltipStats.visible = false;
    }

    update(entities: Entity[], _delta: number): void {
        const uistate = this.getUIState(entities);

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
        this.renderTooltip();
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

    private returnHeldItem(): void {
        if (!this.heldItem) return;

        const inventory = this.heldSource === 'player'
            ? this.targetEntity?.getComponent<InventoryComponent>('inventory')
            : this.containerEntity?.getComponent<InventoryComponent>('inventory');

        if (!inventory) {
            this.clearHeld();
            return;
        }

        if (this.heldFromSlot >= 0 && this.heldFromSlot < inventory.capacity && inventory.items[this.heldFromSlot] === null) {
            inventory.items[this.heldFromSlot] = { ...this.heldItem };
        } else {
            const emptySlot = inventory.items.findIndex(item => item === null);
            if (emptySlot >= 0) {
                inventory.items[emptySlot] = { ...this.heldItem };
            }
        }
        this.clearHeld();
    }

    // ============================================================
    // 渲染
    // ============================================================

    private getPanelLayout(): {
        leftGridX: number;
        rightGridX: number | null;
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
        let rightGridX: number | null = null;
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
            this.panelW = totalW;
            this.panelH = leftPanelH;
        } else {
            // 普通背包模式：左侧背包 + 右侧装备栏
            const gapBetween = 24 * scale;
            const equipLabelH = 14 * scale;
            const equipGridH = cellSize;
            const rightH = equipGridH + equipLabelH + padding * 2;
            const maxH = Math.max(leftPanelH, rightH);
            const totalW = panelW * 2 + gapBetween;
            leftGridX = cx - totalW / 2;
            rightGridX = leftGridX + panelW + gapBetween;
            gridY = cy - maxH / 2;

            rightPanelH = maxH;
            equipGridY = gridY + padding + equipLabelH;
            const equipSlotTotalW = 3 * cellSize + 2 * (gap * 3);
            equipGridX = rightGridX + (panelW - padding * 2 - equipSlotTotalW) / 2;

            this.panelW = totalW;
            this.panelH = maxH;
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

        if (this.isContainerMode && rightGridX !== null) {
            // 容器面板背景（右侧）
            this.panel.fillStyle(0x1a1a2e, 0.95);
            this.panel.fillRoundedRect(rightGridX - padding, gridY - padding, panelW, leftPanelH, 8 * scale);
            this.panel.lineStyle(2 * scale, 0x444466, 1);
            this.panel.strokeRoundedRect(rightGridX - padding, gridY - padding, panelW, leftPanelH, 8 * scale);
        } else if (!this.isContainerMode && rightGridX !== null) {
            // 装备栏面板背景（右侧）
            this.panel.fillStyle(0x1a1a2e, 0.95);
            this.panel.fillRoundedRect(rightGridX - padding, gridY - padding, panelW, rightPanelH, 8 * scale);
            this.panel.lineStyle(2 * scale, 0x444466, 1);
            this.panel.strokeRoundedRect(rightGridX - padding, gridY - padding, panelW, rightPanelH, 8 * scale);
        }

        // 绘制格子和物品
        this.itemGraphics.clear();
        let textIdx = 0;

        // 玩家格子（左侧）
        for (let i = 0; i < playerInventory.capacity; i++) {
            textIdx = this.renderSlot(leftGridX, gridY, i, playerInventory, scale, textIdx);
        }

        // 容器格子（右侧）
        if (this.isContainerMode && rightGridX !== null && containerInventory) {
            for (let i = 0; i < containerInventory.capacity; i++) {
                textIdx = this.renderSlot(rightGridX, gridY, i, containerInventory, scale, textIdx);
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
                textIdx = this.renderEquipSlot(slotX, equipGridY, equipItems[i], scale, textIdx);
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

        this.panel.visible = true;
        this.itemGraphics.visible = true;
    }

    private renderSlot(
        gridX: number,
        gridY: number,
        index: number,
        inventory: InventoryComponent,
        scale: number,
        textIdx: number
    ): number {
        const cellSize = this.BASE_CELL_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const slotX = gridX + (index % this.COLS) * (cellSize + gap);
        const slotY = gridY + Math.floor(index / this.COLS) * (cellSize + gap);

        // 格子背景
        this.itemGraphics.fillStyle(0x2a2a3e, 1);
        this.itemGraphics.fillRect(slotX, slotY, cellSize, cellSize);

        // 格子边框
        this.itemGraphics.lineStyle(Math.max(1, scale), 0x555577, 1);
        this.itemGraphics.strokeRect(slotX, slotY, cellSize, cellSize);

        // 物品方块
        const item = inventory.items[index];
        if (item) {
            const color = this.itemColors[item.itemId] ?? 0xaaaaaa;
            this.itemGraphics.fillStyle(color, 1);
            this.itemGraphics.fillRect(slotX + 4 * scale, slotY + 4 * scale, cellSize - 8 * scale, cellSize - 8 * scale);

            if (textIdx < this.quantityTexts.length) {
                const text = this.quantityTexts[textIdx];
                text.setPosition(slotX + cellSize - 3 * scale, slotY + cellSize - 2 * scale);
                text.setScale(scale);
                text.setText(item.quantity > 1 ? String(item.quantity) : '');
                text.visible = true;
                textIdx++;
            }
        }

        return textIdx;
    }

    private renderEquipSlot(
        gridX: number,
        gridY: number,
        item: InventoryItem | null,
        scale: number,
        textIdx: number
    ): number {
        const cellSize = this.BASE_CELL_SIZE * scale;

        // 格子背景
        this.itemGraphics.fillStyle(0x2a2a3e, 1);
        this.itemGraphics.fillRect(gridX, gridY, cellSize, cellSize);

        // 装备栏边框（蓝色突出）
        this.itemGraphics.lineStyle(Math.max(1, scale), 0x6677aa, 1);
        this.itemGraphics.strokeRect(gridX, gridY, cellSize, cellSize);

        if (item) {
            const color = this.itemColors[item.itemId] ?? 0xaaaaaa;
            this.itemGraphics.fillStyle(color, 1);
            this.itemGraphics.fillRect(gridX + 4 * scale, gridY + 4 * scale, cellSize - 8 * scale, cellSize - 8 * scale);

            if (textIdx < this.quantityTexts.length) {
                const text = this.quantityTexts[textIdx];
                text.setPosition(gridX + cellSize - 3 * scale, gridY + cellSize - 2 * scale);
                text.setScale(scale);
                text.setText(item.quantity > 1 ? String(item.quantity) : '');
                text.visible = true;
                textIdx++;
            }
        }

        return textIdx;
    }

    private renderHeldItem(): void {
        if (!this.heldItem) {
            this.heldGraphics.visible = false;
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

        this.heldGraphics.clear();
        this.heldGraphics.fillStyle(this.itemColors[this.heldItem.itemId] ?? 0xaaaaaa, 0.9);
        this.heldGraphics.fillRect(hx, hy, size, size);
        this.heldGraphics.lineStyle(2 * scale, 0xffffff, 0.6);
        this.heldGraphics.strokeRect(hx, hy, size, size);
        this.heldGraphics.visible = true;

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
        this.heldGraphics.visible = false;
        this.heldText.visible = false;
        for (const text of this.quantityTexts) {
            text.visible = false;
        }
        this.equipLabel.visible = false;
        for (const text of this.equipSlotLabels) {
            text.visible = false;
        }
        this.tooltipPanel.visible = false;
        this.tooltipName.visible = false;
        this.tooltipType.visible = false;
        this.tooltipDesc.visible = false;
        this.tooltipStats.visible = false;
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
        const inventory = source === 'player'
            ? this.targetEntity.getComponent<InventoryComponent>('inventory')!
            : this.containerEntity?.getComponent<InventoryComponent>('inventory')!;

        if (!inventory) return;

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;

        if (pointer.button === 0) {
            this.handleLeftClick(inventory, itemsMap, index, source);
        } else if (pointer.button === 2) {
            this.handleRightClick(inventory, itemsMap, index, source);
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

        if (this.isContainerMode && rightGridX !== null) {
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

        return null;
    }

    private handleLeftClick(
        inventory: InventoryComponent,
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number,
        source: 'player' | 'container'
    ): void {
        const slotItem = inventory.items[slot];

        if (!this.heldItem) {
            if (slotItem) {
                this.heldItem = { ...slotItem };
                this.heldFromSlot = slot;
                this.heldSource = source;
                inventory.items[slot] = null;
            }
        } else {
            if (!slotItem) {
                inventory.items[slot] = { ...this.heldItem };
                this.clearHeld();
            } else if (slotItem.itemId === this.heldItem.itemId) {
                this.tryStackAll(inventory, itemsMap, slot, source);
            } else {
                this.swapWithSlot(inventory, slot, source);
            }
        }
    }

    private handleRightClick(
        inventory: InventoryComponent,
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number,
        source: 'player' | 'container'
    ): void {
        const slotItem = inventory.items[slot];
        if (!this.heldItem) {
            if (slotItem) {
                const half = Math.ceil(slotItem.quantity / 2);
                this.heldItem = { itemId: slotItem.itemId, quantity: half };
                this.heldFromSlot = slot;
                this.heldSource = source;
                slotItem.quantity -= half;
                if (slotItem.quantity <= 0) {
                    inventory.items[slot] = null;
                }
            }
        } else {
            if (!slotItem) {
                this.placeOne(inventory, slot);
            } else if (slotItem.itemId === this.heldItem.itemId) {
                this.tryStackOne(inventory, itemsMap, slot);
            } else {
                this.swapWithSlot(inventory, slot, source);
            }
        }
    }

    private tryStackAll(
        inventory: InventoryComponent,
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number,
        source: 'player' | 'container'
    ): void {
        if (!this.heldItem) return;
        const def = itemsMap?.[this.heldItem.itemId];
        const slotItem = inventory.items[slot];
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
        this.swapWithSlot(inventory, slot, source);
    }

    private tryStackOne(
        inventory: InventoryComponent,
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number
    ): void {
        if (!this.heldItem) return;
        const def = itemsMap?.[this.heldItem.itemId];
        const slotItem = inventory.items[slot];
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
        // 同面板时交换，跨面板时不做交换（保持 held）
        const currentSource = inventory === this.targetEntity?.getComponent<InventoryComponent>('inventory') ? 'player' : 'container';
        this.swapWithSlot(inventory, slot, currentSource);
    }

    private placeOne(inventory: InventoryComponent, slot: number): void {
        if (!this.heldItem) return;
        inventory.items[slot] = { itemId: this.heldItem.itemId, quantity: 1 };
        this.heldItem.quantity--;
        if (this.heldItem.quantity <= 0) {
            this.clearHeld();
        }
    }

    private swapWithSlot(inventory: InventoryComponent, slot: number, source: 'player' | 'container'): void {
        if (!this.heldItem) return;
        const temp = inventory.items[slot];
        inventory.items[slot] = { ...this.heldItem };
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

    private renderTooltip(): void {
        if (!this.targetEntity) {
            this.hideTooltip();
            return;
        }

        const pointer = this.scene.input.activePointer;
        const slotInfo = this.getSlotAt(pointer.x, pointer.y);

        if (!slotInfo) {
            this.hideTooltip();
            return;
        }

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
        }

        if (!item) {
            this.hideTooltip();
            return;
        }

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;
        const def = itemsMap?.[item.itemId];
        if (!def) {
            this.hideTooltip();
            return;
        }

        const { x: worldX, y: worldY } = this.screenToWorld(pointer.x, pointer.y);
        const scale = this.uiScale;

        // 构建 Tooltip 文本
        const nameText = def.name;
        const typeText = this.typeLabel(def.type);
        const descText = def.description;

        let statsText = '';
        if (def.type === 'equipment' && def.equipment) {
            const attrs: string[] = [];
            if (def.equipment.attack) attrs.push(`攻击 +${def.equipment.attack}`);
            if (def.equipment.defense) attrs.push(`防御 +${def.equipment.defense}`);
            attrs.push(`部位: ${this.slotLabel(def.equipment.slot)}`);
            statsText = attrs.join('  ');
        } else if (def.type === 'consumable' && def.useEffect) {
            statsText = `效果: ${this.effectLabel(def.useEffect.type)} ${def.useEffect.value}`;
        } else if (def.value) {
            statsText = `价值: ${def.value} 金币`;
        }

        // 测量文本尺寸（位图字体字符宽度 ≈ fontSize）
        const pad = 8 * scale;
        const nameLineH = 18 * scale;
        const bodyLineH = 14 * scale;
        const nameFontSize = 16 * scale;
        const bodyFontSize = 12 * scale;
        const maxTextW = Math.max(
            nameText.length * nameFontSize,
            typeText.length * bodyFontSize,
            descText.length * bodyFontSize,
            statsText.length * bodyFontSize
        );
        const tooltipW = Math.max(maxTextW + pad * 2, 140 * scale);
        const tooltipH = nameLineH + bodyLineH * 2 + (statsText ? bodyLineH : 0) + pad * 2;

        // 边界检查
        let tx = worldX + 16 * scale;
        let ty = worldY + 16 * scale;
        const cam = this.scene.cameras.main;
        const camRight = cam.midPoint.x + (cam.width / 2 / (cam.zoom || 1));
        const camBottom = cam.midPoint.y + (cam.height / 2 / (cam.zoom || 1));
        if (tx + tooltipW > camRight) {
            tx = worldX - tooltipW - 8 * scale;
        }
        if (ty + tooltipH > camBottom) {
            ty = worldY - tooltipH - 8 * scale;
        }

        // 绘制背景
        this.tooltipPanel.clear();
        this.tooltipPanel.fillStyle(0x0a0a18, 1);
        this.tooltipPanel.fillRoundedRect(tx, ty, tooltipW, tooltipH, 4 * scale);
        this.tooltipPanel.lineStyle(Math.max(1, scale), 0x444466, 1);
        this.tooltipPanel.strokeRoundedRect(tx, ty, tooltipW, tooltipH, 4 * scale);
        this.tooltipPanel.visible = true;

        // 名称
        this.tooltipName.setPosition(tx + pad, ty + pad);
        this.tooltipName.setScale(scale);
        this.tooltipName.setText(nameText);
        this.tooltipName.setColor(this.getRarityColor(def.type));
        this.tooltipName.visible = true;

        // 类型
        this.tooltipType.setPosition(tx + pad, ty + pad + nameLineH);
        this.tooltipType.setScale(scale);
        this.tooltipType.setText(`[${typeText}]`);
        this.tooltipType.visible = true;

        // 描述
        this.tooltipDesc.setPosition(tx + pad, ty + pad + nameLineH + bodyLineH);
        this.tooltipDesc.setScale(scale);
        this.tooltipDesc.setText(descText);
        this.tooltipDesc.visible = true;

        // 属性
        if (statsText) {
            this.tooltipStats.setPosition(tx + pad, ty + pad + nameLineH + bodyLineH * 2);
            this.tooltipStats.setScale(scale);
            this.tooltipStats.setText(statsText);
            this.tooltipStats.visible = true;
        } else {
            this.tooltipStats.visible = false;
        }
    }

    private hideTooltip(): void {
        this.tooltipPanel.visible = false;
        this.tooltipName.visible = false;
        this.tooltipType.visible = false;
        this.tooltipDesc.visible = false;
        this.tooltipStats.visible = false;
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
