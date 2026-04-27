import * as ex from 'excalibur';
import { InventoryComponent } from '../components/inventory-component';
import { ItemBase } from '../item-base';
import { GridContainerSystem } from '../systems/grid-container-system';
import { InventoryPane } from './inventory-pane';
import { HoverTooltip } from './hover-tooltip';
import { getSharedInventoryDragManager } from './inventory-drag-manager';
import { Asset } from '../asset';
import { ItemFactory } from '../item-base';

export class ShopUI extends ex.ScreenElement {
    private playerInventory: InventoryComponent | null = null;
    private merchantInventory: InventoryComponent | null = null;
    private playerOwner: ex.Entity | null = null;
    private merchantName: string = '商人';
    private background: ex.Rectangle;
    private isVisible: boolean = false;
    private dirty: boolean = false;
    private readonly dragManager;
    private readonly hoverTooltip: HoverTooltip;
    private staticSlots: ex.Actor[] = [];

    private readonly SLOT_SIZE = 32;
    private readonly SLOT_MARGIN = 4;

    private readonly playerPane: InventoryPane;
    private readonly merchantPane: InventoryPane;

    private pendingTransaction: { type: 'buy' | 'sell'; price: number } | null = null;

    constructor(engine: ex.Engine) {
        super({
            x: 400,
            y: 300,
            width: 520,
            height: 320,
            anchor: ex.Vector.Half,
            z: 1200
        });

        this.background = new ex.Rectangle({
            width: 520,
            height: 320,
            color: ex.Color.fromHex('#1f1b18ee'),
            strokeColor: ex.Color.fromHex('#d7c5a3'),
            lineWidth: 2
        });

        const paneStyle = InventoryPane.createStyle({
            slotColor: ex.Color.fromHex('#4a443c'),
            slotStrokeColor: ex.Color.fromHex('#b8a98d')
        });

        this.playerPane = new InventoryPane({
            title: '玩家背包',
            startX: -250,
            startY: -70,
            headerY: -100,
            slotSize: this.SLOT_SIZE,
            slotMargin: this.SLOT_MARGIN,
            gridWidth: 6,
            gridHeight: 4,
            zBase: 1200,
            style: paneStyle
        });
        this.playerPane.attachTo(this);

        this.merchantPane = new InventoryPane({
            title: '商人背包',
            startX: 20,
            startY: -70,
            headerY: -100,
            slotSize: this.SLOT_SIZE,
            slotMargin: this.SLOT_MARGIN,
            gridWidth: 6,
            gridHeight: 4,
            zBase: 1200,
            style: paneStyle
        });
        this.merchantPane.attachTo(this);

        this.dragManager = getSharedInventoryDragManager(engine);

        this.hoverTooltip = new HoverTooltip({
            width: 240,
            height: 74,
            textOffsetX: 12,
            textOffsetY: 11
        });
        this.hoverTooltip.attachTo(this);
    }

    public show(playerOwner: ex.Entity, playerInventory: InventoryComponent, merchantInventory: InventoryComponent, merchantName: string) {
        this.playerOwner = playerOwner;
        this.playerInventory = playerInventory;
        this.merchantInventory = merchantInventory;
        this.merchantName = merchantName;
        this.playerPane.setInventory(playerInventory);
        this.merchantPane.setInventory(merchantInventory);
        this.isVisible = true;
        this.dirty = true;
        this.graphics.use(this.background);
        this.graphics.visible = true;
        this.registerPanes();
        this.updateDisplay();
    }

    public hide() {
        this.isVisible = false;
        this.playerInventory = null;
        this.merchantInventory = null;
        this.playerOwner = null;
        this.merchantName = '商人';
        this.hideHover();
        this.dragManager.unregisterPane('shop-player');
        this.dragManager.unregisterPane('shop-merchant');
        this.graphics.hide();
        this.playerPane.setInventory(null);
        this.merchantPane.setInventory(null);
        this.playerPane.clear();
        this.merchantPane.clear();
        this.clearStaticSlots();
        this.pendingTransaction = null;
    }

    public refresh() {
        if (this.isVisible && this.dirty) {
            this.dirty = false;
            this.updateDisplay();
        }
    }

    public isOpen(): boolean {
        return this.isVisible;
    }

    public markDirty() {
        this.dirty = true;
    }

    override onPostUpdate(_engine: ex.Engine, _delta: number): void {
        if (this.isVisible) {
            this.playerPane.render();
            this.merchantPane.render();
        }
    }

    // ---- 交易核心逻辑 ----

    /** 买入：检查玩家金币是否足够 */
    private canBuy(item: ItemBase): boolean {
        const price = item.value * item.quantity;
        const playerGold = this.getGoldCount(this.playerInventory);
        if (playerGold < price) {
            this.pendingTransaction = null;
            this.showToast('金币不足');
            return false;
        }
        this.pendingTransaction = { type: 'buy', price };
        return true;
    }

    /** 卖出：总是允许 */
    private canSell(item: ItemBase): boolean {
        const price = item.id === 'gold_coin' ? item.quantity : item.value * item.quantity;
        this.pendingTransaction = { type: 'sell', price };
        return true;
    }

    /** 处理待执行的金币交易 */
    private handleTransaction() {
        if (!this.pendingTransaction) return;
        const tx = this.pendingTransaction;
        this.pendingTransaction = null;

        const playerInv = this.playerInventory;
        const merchantInv = this.merchantInventory;
        if (!playerInv || !merchantInv) return;

        if (tx.type === 'buy') {
            // 买入：玩家给商人金币
            this.moveGold(playerInv, merchantInv, tx.price);
        } else {
            // 卖出：商人给玩家金币
            this.moveGold(merchantInv, playerInv, tx.price);
        }
    }

    /** 获取容器中金币数量 */
    private getGoldCount(container: InventoryComponent | null): number {
        if (!container) return 0;
        const goldItem = GridContainerSystem.findItemByTypeId(container, 'gold_coin');
        return goldItem?.quantity ?? 0;
    }

    /** 从 from 容器转移金币到 to 容器 */
    private moveGold(from: InventoryComponent, to: InventoryComponent, amount: number) {
        if (amount <= 0) return;
        const fromGold = GridContainerSystem.findItemByTypeId(from, 'gold_coin');
        if (!fromGold || fromGold.quantity < amount) return;

        GridContainerSystem.removeItem(from, fromGold.uid, amount);

        const goldConfig = Asset.itemDataMap?.get('gold_coin');
        if (goldConfig) {
            const goldItem = ItemFactory.fromConfig(goldConfig);
            goldItem.quantity = amount;
            GridContainerSystem.addItem(to, goldItem);
        }
    }

    // ---- UI ----

    private updateDisplay() {
        if (!this.isVisible) return;

        this.playerPane.render();
        this.merchantPane.render();
        this.clearStaticSlots();

        this.addHint('拖动物品到对方背包即可完成买卖', 0, 110, 14, ex.Color.fromHex('#d7c5a3'));
        this.addHint('商人背包 → 玩家背包 = 买入（消耗金币）', 0, 130, 12, ex.Color.fromHex('#b8a98d'));
        this.addHint('玩家背包 → 商人背包 = 卖出（获得金币）', 0, 144, 12, ex.Color.fromHex('#b8a98d'));
    }

    private addHint(text: string, x: number, y: number, size: number, color: ex.Color) {
        const hintLabel = new ex.Label({
            text,
            font: new ex.Font({
                family: 'Arial',
                size: size,
                color,
                textAlign: ex.TextAlign.Center
            }),
            pos: ex.vec(x, y),
            z: 1201
        });
        this.addChild(hintLabel);
        this.staticSlots.push(hintLabel);
    }

    private clearStaticSlots() {
        this.staticSlots.forEach(slot => this.removeChild(slot));
        this.staticSlots = [];
    }

    private registerPanes() {
        this.dragManager.registerPane({
            id: 'shop-player',
            pane: this.playerPane,
            getContainer: () => this.playerInventory,
            screenToLocal: (screenPos) => screenPos.sub(this.pos),
            localToScreen: (localPos) => this.pos.add(localPos),
            canAcceptDrop: (_sourcePaneId, item) => {
                if (_sourcePaneId !== 'shop-merchant') return false;
                return this.canBuy(item);
            },
            onHover: (ctx) => {
                if (!ctx.item) { this.hideHover(); return; }
                this.showHover(ctx.item, ctx.localPos);
            },
            onChanged: () => { this.handleTransaction(); this.dirty = true; this.updateDisplay(); },
            isActive: () => this.isVisible
        });

        this.dragManager.registerPane({
            id: 'shop-merchant',
            pane: this.merchantPane,
            getContainer: () => this.merchantInventory,
            screenToLocal: (screenPos) => screenPos.sub(this.pos),
            localToScreen: (localPos) => this.pos.add(localPos),
            canAcceptDrop: (sourcePaneId, item) => {
                if (sourcePaneId !== 'shop-player') return false;
                return this.canSell(item);
            },
            onHover: (ctx) => {
                if (!ctx.item) { this.hideHover(); return; }
                this.showHover(ctx.item, ctx.localPos);
            },
            onChanged: () => { this.handleTransaction(); this.dirty = true; this.updateDisplay(); },
            isActive: () => this.isVisible
        });
    }

    private showHover(item: ItemBase, localPos: ex.Vector) {
        const priceText = item.id === 'gold_coin'
            ? `价值: 1`
            : `售价: ${item.value}`;
        this.hoverTooltip.show(
            `${item.name}\n${item.description}\n数量: ${item.quantity}\n${priceText}`,
            localPos,
            ex.vec(128, 64)
        );
    }

    private hideHover() {
        this.hoverTooltip.hide();
    }

    private showToast(text: string) {
        const toast = new ex.Label({
            text,
            font: new ex.Font({ family: 'Arial', size: 16, color: ex.Color.Red, textAlign: ex.TextAlign.Center }),
            pos: ex.vec(0, 90),
            z: 1202
        });
        this.addChild(toast);
        setTimeout(() => {
            if (toast.parent) {
                this.removeChild(toast);
            }
        }, 2000);
    }
}
