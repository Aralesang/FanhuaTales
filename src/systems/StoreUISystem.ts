import { Scene, GameObjects, Input } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import {
    InventoryComponent, ItemDefinition, InventoryItem,
    SettingsComponent, UIStateComponent, StoreComponent
} from '../ecs/Component';
import { InventorySystem } from './InventorySystem';

interface SlotRef {
    source: 'store' | 'player';
    index: number;
}

export class StoreUISystem extends System {
    private isOpen = false;
    private targetEntity: Entity | null = null;
    private storeEntity: Entity | null = null;

    private panel!: GameObjects.Graphics;
    private itemGraphics!: GameObjects.Graphics;
    private quantityTexts: GameObjects.Text[] = [];

    // Tooltip
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

        // Tooltip
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

        // 外部打开（StoreSystem E键交互）
        if (uistate?.storeOpen && !this.isOpen) {
            const player = entities.find(e => e.hasComponent('inventory') && e.hasComponent('player'));
            const store = uistate.activeStore;
            if (player && store) {
                this.isOpen = true;
                this.targetEntity = player;
                this.storeEntity = store;
            }
        }

        // 外部关闭请求
        if (uistate && !uistate.storeOpen && this.isOpen) {
            this.isOpen = false;
            this.targetEntity = null;
            this.storeEntity = null;
        }

        // 读取全局 UI 缩放
        const settingsEntity = entities.find(e => e.hasComponent('settings'));
        const settings = settingsEntity?.getComponent<SettingsComponent>('settings');
        this.uiScale = settings?.uiScale ?? 1.0;

        if (!this.isOpen || !this.targetEntity || !this.storeEntity) {
            this.hideAll();
            return;
        }

        this.renderGrid();
        this.renderTooltip();
    }

    private getUIState(entities: Entity[]): UIStateComponent | undefined {
        const entity = entities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<UIStateComponent>('uistate');
    }

    private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
        const cam = this.scene.cameras.main;
        const worldPoint = cam.getWorldPoint(screenX, screenY);
        return { x: worldPoint.x, y: worldPoint.y };
    }

    private getPanelLayout(): {
        leftGridX: number;
        rightGridX: number;
        gridY: number;
        panelW: number;
        panelH: number;
    } {
        const cam = this.scene.cameras.main;
        const scale = this.uiScale;

        const cellSize = this.BASE_CELL_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const padding = this.BASE_PADDING * scale;

        const panelW = this.COLS * cellSize + (this.COLS - 1) * gap + padding * 2;
        const panelH = this.ROWS * cellSize + (this.ROWS - 1) * gap + padding * 2;

        const cx = cam.midPoint.x;
        const cy = cam.midPoint.y;

        const gapBetween = 24 * scale;
        const totalW = panelW * 2 + gapBetween;
        const leftGridX = cx - totalW / 2;
        const rightGridX = leftGridX + panelW + gapBetween;
        const gridY = cy - panelH / 2;
        this.panelW = totalW;
        this.panelH = panelH;

        return { leftGridX, rightGridX, gridY, panelW, panelH };
    }

    private renderGrid(): void {
        if (!this.targetEntity || !this.storeEntity) return;

        const playerInventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        const storeComp = this.storeEntity.getComponent<StoreComponent>('store')!;

        const scale = this.uiScale;
        const { leftGridX, rightGridX, gridY, panelW, panelH } = this.getPanelLayout();
        const padding = this.BASE_PADDING * scale;

        // 绘制背景面板
        this.panel.clear();

        // 玩家面板背景（左侧）
        this.panel.fillStyle(0x1a1a2e, 0.95);
        this.panel.fillRoundedRect(leftGridX - padding, gridY - padding, panelW, panelH, 8 * scale);
        this.panel.lineStyle(2 * scale, 0x444466, 1);
        this.panel.strokeRoundedRect(leftGridX - padding, gridY - padding, panelW, panelH, 8 * scale);

        // 商店面板背景（右侧）
        this.panel.fillStyle(0x1a1a2e, 0.95);
        this.panel.fillRoundedRect(rightGridX - padding, gridY - padding, panelW, panelH, 8 * scale);
        this.panel.lineStyle(2 * scale, 0x444466, 1);
        this.panel.strokeRoundedRect(rightGridX - padding, gridY - padding, panelW, panelH, 8 * scale);

        // 绘制格子和物品
        this.itemGraphics.clear();
        let textIdx = 0;

        // 玩家格子（左侧）
        for (let i = 0; i < playerInventory.capacity; i++) {
            textIdx = this.renderSlot(leftGridX, gridY, i, playerInventory.items[i], scale, textIdx, 'player');
        }

        // 商店格子（右侧）
        const storeCount = this.COLS * this.ROWS;
        for (let i = 0; i < storeCount; i++) {
            textIdx = this.renderSlot(rightGridX, gridY, i, storeComp.goods[i] ?? null, scale, textIdx, 'store');
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
        item: InventoryItem | null,
        scale: number,
        textIdx: number,
        source: 'store' | 'player'
    ): number {
        const cellSize = this.BASE_CELL_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const slotX = gridX + (index % this.COLS) * (cellSize + gap);
        const slotY = gridY + Math.floor(index / this.COLS) * (cellSize + gap);

        // 格子背景
        this.itemGraphics.fillStyle(0x2a2a3e, 1);
        this.itemGraphics.fillRect(slotX, slotY, cellSize, cellSize);

        // 格子边框（商店物品用金色边框突出）
        if (source === 'store' && item) {
            this.itemGraphics.lineStyle(Math.max(1, scale), 0xaa8844, 1);
        } else {
            this.itemGraphics.lineStyle(Math.max(1, scale), 0x555577, 1);
        }
        this.itemGraphics.strokeRect(slotX, slotY, cellSize, cellSize);

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

    private hideAll(): void {
        this.panel.visible = false;
        this.itemGraphics.visible = false;
        for (const text of this.quantityTexts) {
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
        if (!this.isOpen || !this.targetEntity || !this.storeEntity) return;

        const slotInfo = this.getSlotAt(pointer.x, pointer.y);
        if (!slotInfo) return;

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;
        if (!itemsMap) return;

        const { source, index } = slotInfo;

        if (source === 'store') {
            this.handleBuy(index, itemsMap);
        } else {
            this.handleSell(index, itemsMap);
        }
    }

    private handleBuy(storeIndex: number, itemsMap: Record<string, ItemDefinition>): void {
        if (!this.storeEntity || !this.targetEntity) return;

        const storeComp = this.storeEntity.getComponent<StoreComponent>('store')!;
        const goods = storeComp.goods;

        if (storeIndex < 0 || storeIndex >= goods.length || !goods[storeIndex]) return;

        const itemToBuy = goods[storeIndex];
        const def = itemsMap[itemToBuy.itemId];
        if (!def || !def.buyPrice) return; // 没有买入价格则不能购买

        const playerInventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;

        // 检查玩家是否有足够货币
        for (const [currencyId, requiredQty] of Object.entries(def.buyPrice)) {
            const total = this.countItem(playerInventory, currencyId);
            if (total < requiredQty) {
                console.log(`[Store] 货币不足: 需要 ${requiredQty} ${currencyId}, 只有 ${total}`);
                return;
            }
        }

        // 扣除货币
        for (const [currencyId, requiredQty] of Object.entries(def.buyPrice)) {
            this.removeItem(playerInventory, currencyId, requiredQty);
        }

        // 给予商品
        InventorySystem.addItem(playerInventory, itemsMap, itemToBuy.itemId, 1);
        console.log(`[Store] 购买 ${def.name} x1`);
    }

    private handleSell(playerSlot: number, itemsMap: Record<string, ItemDefinition>): void {
        if (!this.targetEntity) return;

        const playerInventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        const slotItem = playerInventory.items[playerSlot];
        if (!slotItem) return;

        const def = itemsMap[slotItem.itemId];
        if (!def || !def.sellPrice) return; // 没有出售价格则不能出售

        // 扣除玩家物品（数量1）
        slotItem.quantity--;
        if (slotItem.quantity <= 0) {
            playerInventory.items[playerSlot] = null;
        }

        // 给予出售货币
        for (const [currencyId, qty] of Object.entries(def.sellPrice)) {
            InventorySystem.addItem(playerInventory, itemsMap, currencyId, qty);
        }

        console.log(`[Store] 出售 ${def.name} x1`);
    }

    /** 计算玩家库存中某物品的总数量 */
    private countItem(inventory: InventoryComponent, itemId: string): number {
        let total = 0;
        for (const item of inventory.items) {
            if (item && item.itemId === itemId) {
                total += item.quantity;
            }
        }
        return total;
    }

    /** 从玩家库存中扣除指定数量的某物品 */
    private removeItem(inventory: InventoryComponent, itemId: string, quantity: number): void {
        let remaining = quantity;
        for (let i = 0; i < inventory.capacity && remaining > 0; i++) {
            const item = inventory.items[i];
            if (item && item.itemId === itemId) {
                const remove = Math.min(item.quantity, remaining);
                item.quantity -= remove;
                remaining -= remove;
                if (item.quantity <= 0) {
                    inventory.items[i] = null;
                }
            }
        }
    }

    private getSlotAt(screenX: number, screenY: number): SlotRef | null {
        const { x: worldX, y: worldY } = this.screenToWorld(screenX, screenY);
        const scale = this.uiScale;
        const cellSize = this.BASE_CELL_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const { leftGridX, rightGridX, gridY } = this.getPanelLayout();

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

        // 检测商店面板（右侧）
        const storeRelX = worldX - rightGridX;
        const storeRelY = worldY - gridY;
        for (let i = 0; i < this.COLS * this.ROWS; i++) {
            const slotX = (i % this.COLS) * (cellSize + gap);
            const slotY = Math.floor(i / this.COLS) * (cellSize + gap);
            if (
                storeRelX >= slotX && storeRelX < slotX + cellSize &&
                storeRelY >= slotY && storeRelY < slotY + cellSize
            ) {
                return { source: 'store', index: i };
            }
        }

        return null;
    }

    // ============================================================
    // Tooltip
    // ============================================================

    private renderTooltip(): void {
        if (!this.targetEntity || !this.storeEntity) {
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
        const storeComp = this.storeEntity.getComponent<StoreComponent>('store')!;
        const playerInventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;

        const item = source === 'store'
            ? (index < storeComp.goods.length ? storeComp.goods[index] : null)
            : (index < playerInventory.capacity ? playerInventory.items[index] : null);

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

        let priceText = '';
        if (source === 'store' && def.buyPrice) {
            const priceEntries = Object.entries(def.buyPrice).map(
                ([id, qty]) => `${itemsMap?.[id]?.name ?? id} x${qty}`
            );
            priceText = `买入: ${priceEntries.join(', ')}`;
        } else if (source === 'player' && def.sellPrice) {
            const priceEntries = Object.entries(def.sellPrice).map(
                ([id, qty]) => `${itemsMap?.[id]?.name ?? id} x${qty}`
            );
            priceText = `卖出: ${priceEntries.join(', ')}`;
        } else if (source === 'player' && !def.sellPrice) {
            priceText = '不可出售';
        } else if (source === 'store' && !def.buyPrice) {
            priceText = '不可购买';
        }

        let statsText = '';
        if (def.type === 'equipment' && def.equipment) {
            const attrs: string[] = [];
            if (def.equipment.attack) attrs.push(`攻击 +${def.equipment.attack}`);
            if (def.equipment.defense) attrs.push(`防御 +${def.equipment.defense}`);
            attrs.push(`部位: ${this.slotLabel(def.equipment.slot)}`);
            statsText = attrs.join('  ');
        } else if (def.type === 'consumable' && def.useEffect) {
            statsText = `效果: ${this.effectLabel(def.useEffect.type)} ${def.useEffect.value}`;
        }

        // 测量文本尺寸
        const pad = 8 * scale;
        const nameLineH = 18 * scale;
        const bodyLineH = 14 * scale;
        const nameFontSize = 16 * scale;
        const bodyFontSize = 12 * scale;
        const maxTextW = Math.max(
            nameText.length * nameFontSize,
            typeText.length * bodyFontSize,
            descText.length * bodyFontSize,
            priceText.length * bodyFontSize,
            statsText.length * bodyFontSize
        );
        const tooltipW = Math.max(maxTextW + pad * 2, 140 * scale);
        const tooltipH = nameLineH + bodyLineH * 3 + (statsText ? bodyLineH : 0) + pad * 2;

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

        // 价格
        this.tooltipStats.setPosition(tx + pad, ty + pad + nameLineH + bodyLineH * 2);
        this.tooltipStats.setScale(scale);
        this.tooltipStats.setColor(priceText.startsWith('不可') ? '#ff6666' : '#ffcc44');
        this.tooltipStats.setText(priceText);
        this.tooltipStats.visible = true;
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
}
