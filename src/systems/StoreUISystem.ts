import { Scene, GameObjects, Input } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { FontConfig } from '../config/FontConfig';
import {
    InventoryComponent, ItemDefinition, InventoryItem,
    SettingsComponent, UIStateComponent, StoreComponent,
    BankComponent
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
    private itemSprites: GameObjects.Sprite[] = [];
    private quantityTexts: GameObjects.Text[] = [];

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

        // 道具图标精灵池：玩家 20 + 商店 20 = 40
        for (let i = 0; i < 40; i++) {
            const sprite = this.scene.add.sprite(0, 0, 'item_notfind');
            sprite.setDepth(1001);
            sprite.setOrigin(0, 0);
            sprite.visible = false;
            this.itemSprites.push(sprite);
        }

        for (let i = 0; i < 40; i++) {
            const text = this.createText(0, 0, '', {
                fontSize: FontConfig.small.size, color: '#ffffff',
                fontFamily: FontConfig.small.family,
            });
            text.setDepth(1002);
            text.setOrigin(1, 1);
            text.visible = false;
            this.quantityTexts.push(text);
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
        this.checkHoverAndSetTooltip(uistate);
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

        // 银行余额显示（背包面板下方，独立小块）
        const bankComp = this.targetEntity.getComponent<BankComponent>('bank');
        const bankGold = bankComp?.gold ?? 0;
        const balanceText = `银行: ${bankGold} 金币`;
        const bgW = 88 * scale;
        const bgH = 18 * scale;
        const bgX = leftGridX - padding + 6 * scale;
        const bgY = gridY - padding + panelH + 6 * scale;
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

        // 绘制格子和物品
        this.itemGraphics.clear();
        let textIdx = 0;
        let spriteIdx = 0;

        // 玩家格子（左侧）
        for (let i = 0; i < playerInventory.capacity; i++) {
            ({ textIdx, spriteIdx } = this.renderSlot(leftGridX, gridY, i, playerInventory.items[i], scale, textIdx, spriteIdx, 'player'));
        }

        // 商店格子（右侧）
        const storeCount = this.COLS * this.ROWS;
        for (let i = 0; i < storeCount; i++) {
            ({ textIdx, spriteIdx } = this.renderSlot(rightGridX, gridY, i, storeComp.goods[i] ?? null, scale, textIdx, spriteIdx, 'store'));
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

    private renderSlot(
        gridX: number,
        gridY: number,
        index: number,
        item: InventoryItem | null,
        scale: number,
        textIdx: number,
        spriteIdx: number,
        source: 'store' | 'player'
    ): { textIdx: number; spriteIdx: number } {
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
            // 道具图标
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

    private hideAll(): void {
        this.panel.visible = false;
        this.itemGraphics.visible = false;
        for (const sprite of this.itemSprites) {
            sprite.visible = false;
        }
        for (const text of this.quantityTexts) {
            text.visible = false;
        }
        this.bankBalanceBg.visible = false;
        this.bankBalanceText.visible = false;
    }

    // ============================================================
    // 点击交互
    // ============================================================

    private onPointerDown(pointer: Input.Pointer): void {
        if (!this.isOpen || !this.targetEntity || !this.storeEntity) return;

        const slotInfo = this.getSlotAt(pointer.x, pointer.y);
        if (!slotInfo) return;

        const itemsMap = this.scene.cache.json.get('items') as Record<string, ItemDefinition> | undefined;
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
        const bankComp = this.targetEntity.getComponent<BankComponent>('bank');

        // 检查玩家是否有足够货币
        for (const [currencyId, requiredQty] of Object.entries(def.buyPrice)) {
            if (currencyId === 'gold_coin') {
                const bankGold = bankComp?.gold ?? 0;
                if (bankGold < requiredQty) {
                    console.log(`[Store] 银行金币不足: 需要 ${requiredQty}, 余额 ${bankGold}`);
                    return;
                }
            } else {
                const total = this.countItem(playerInventory, currencyId);
                if (total < requiredQty) {
                    console.log(`[Store] 货币不足: 需要 ${requiredQty} ${currencyId}, 只有 ${total}`);
                    return;
                }
            }
        }

        // 扣除货币（金币从银行扣，其他从背包扣）
        for (const [currencyId, requiredQty] of Object.entries(def.buyPrice)) {
            if (currencyId === 'gold_coin' && bankComp) {
                bankComp.gold -= requiredQty;
            } else {
                this.removeItem(playerInventory, currencyId, requiredQty);
            }
        }

        // 给予商品
        InventorySystem.addItem(playerInventory, itemsMap, itemToBuy.itemId, 1);
        console.log(`[Store] 购买 ${def.name} x1`);
    }

    private handleSell(playerSlot: number, itemsMap: Record<string, ItemDefinition>): void {
        if (!this.targetEntity) return;

        const playerInventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        const bankComp = this.targetEntity.getComponent<BankComponent>('bank');
        const slotItem = playerInventory.items[playerSlot];
        if (!slotItem) return;

        const def = itemsMap[slotItem.itemId];
        if (!def || !def.sellPrice) return; // 没有出售价格则不能出售

        // 扣除玩家物品（数量1）
        slotItem.quantity--;
        if (slotItem.quantity <= 0) {
            playerInventory.items[playerSlot] = null;
        }

        // 给予出售货币（金币存入银行，其他存入背包）
        for (const [currencyId, qty] of Object.entries(def.sellPrice)) {
            if (currencyId === 'gold_coin' && bankComp) {
                bankComp.gold += qty;
            } else {
                InventorySystem.addItem(playerInventory, itemsMap, currencyId, qty);
            }
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

    private checkHoverAndSetTooltip(uistate: UIStateComponent | undefined): void {
        if (!uistate || !this.targetEntity || !this.storeEntity) return;

        const pointer = this.scene.input.activePointer;
        const slotInfo = this.getSlotAt(pointer.x, pointer.y);
        if (!slotInfo) return;

        const { source, index } = slotInfo;
        const storeComp = this.storeEntity.getComponent<StoreComponent>('store')!;
        const playerInventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;

        const item = source === 'store'
            ? (index < storeComp.goods.length ? storeComp.goods[index] : null)
            : (index < playerInventory.capacity ? playerInventory.items[index] : null);
        if (!item) return;

        const itemsMap = this.scene.cache.json.get('items') as Record<string, ItemDefinition> | undefined;
        const def = itemsMap?.[item.itemId];
        if (!def) return;

        const { x: worldX, y: worldY } = this.screenToWorld(pointer.x, pointer.y);

        let stats = '';
        let statsColor = '#88cc88';
        if (source === 'store' && def.buyPrice) {
            const priceEntries = Object.entries(def.buyPrice).map(
                ([id, qty]) => `${itemsMap?.[id]?.name ?? id} x${qty}`
            );
            stats = `买入: ${priceEntries.join(', ')}`;
            statsColor = '#ffcc44';
        } else if (source === 'player' && def.sellPrice) {
            const priceEntries = Object.entries(def.sellPrice).map(
                ([id, qty]) => `${itemsMap?.[id]?.name ?? id} x${qty}`
            );
            stats = `卖出: ${priceEntries.join(', ')}`;
            statsColor = '#ffcc44';
        } else if (source === 'player' && !def.sellPrice) {
            stats = '不可出售';
            statsColor = '#ff6666';
        } else if (source === 'store' && !def.buyPrice) {
            stats = '不可购买';
            statsColor = '#ff6666';
        }

        if (def.type === 'equipment' && def.equipment) {
            const attrs: string[] = [];
            if (def.equipment.attack) attrs.push(`攻击 +${def.equipment.attack}`);
            if (def.equipment.defense) attrs.push(`防御 +${def.equipment.defense}`);
            attrs.push(`部位: ${this.slotLabel(def.equipment.slot)}`);
            if (stats) stats += '  |  ';
            stats += attrs.join('  ');
        } else if (def.type === 'consumable' && def.useEffect) {
            const eff = def.useEffect;
            let effectText = '';
            if (eff.type === 'apply_buff' && eff.duration !== undefined) {
                effectText = `持续 ${Math.floor(eff.duration / 1000)} 秒`;
            } else if (eff.value !== undefined) {
                effectText = `效果: ${this.effectLabel(eff.type)} ${eff.value}`;
            }
            if (effectText) {
                if (stats) stats += '  |  ';
                stats += effectText;
            }
        }

        uistate.tooltip = {
            x: worldX,
            y: worldY,
            name: def.name,
            nameColor: this.getRarityColor(def.type),
            typeText: this.typeLabel(def.type),
            description: def.description,
            stats,
            statsColor,
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
}
