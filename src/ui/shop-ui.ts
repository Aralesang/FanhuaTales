import * as ex from 'excalibur';
import { InventoryComponent } from '../components/inventory-component';
import { ItemBase } from '../item-base';
import { GridContainerSystem } from '../systems/grid-container-system';
import { InventoryPane } from './inventory-pane';
import { HoverTooltip } from './hover-tooltip';
import { getSharedInventoryDragManager } from './inventory-drag-manager';

export class ShopUI extends ex.ScreenElement {
    private playerInventory: InventoryComponent | null = null;
    private merchantInventory: InventoryComponent | null = null;
    private playerOfferInventory: InventoryComponent;
    private merchantOfferInventory: InventoryComponent;
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
    private readonly playerOfferPane: InventoryPane;
    private readonly merchantOfferPane: InventoryPane;

    private valueLabel: ex.Label | null = null;
    private tradeButton: ex.Actor | null = null;

    constructor(engine: ex.Engine) {
        super({
            x: 400,
            y: 300,
            width: 760,
            height: 400,
            anchor: ex.Vector.Half,
            z: 1200
        });

        this.background = new ex.Rectangle({
            width: 760,
            height: 400,
            color: ex.Color.fromHex('#1f1b18ee'),
            strokeColor: ex.Color.fromHex('#d7c5a3'),
            lineWidth: 2
        });

        const paneStyle = InventoryPane.createStyle({
            slotColor: ex.Color.fromHex('#4a443c'),
            slotStrokeColor: ex.Color.fromHex('#b8a98d')
        });

        const offerStyle = InventoryPane.createStyle({
            slotColor: ex.Color.fromHex('#5a5040'),
            slotStrokeColor: ex.Color.fromHex('#c9b896')
        });

        this.playerPane = new InventoryPane({
            title: '玩家背包',
            startX: -376,
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

        this.playerOfferPane = new InventoryPane({
            title: '你的出价',
            startX: -148,
            startY: -70,
            headerY: -100,
            slotSize: this.SLOT_SIZE,
            slotMargin: this.SLOT_MARGIN,
            gridWidth: 4,
            gridHeight: 3,
            zBase: 1200,
            style: offerStyle
        });
        this.playerOfferPane.attachTo(this);

        this.merchantOfferPane = new InventoryPane({
            title: '商人出价',
            startX: 8,
            startY: -70,
            headerY: -100,
            slotSize: this.SLOT_SIZE,
            slotMargin: this.SLOT_MARGIN,
            gridWidth: 4,
            gridHeight: 3,
            zBase: 1200,
            style: offerStyle
        });
        this.merchantOfferPane.attachTo(this);

        this.merchantPane = new InventoryPane({
            title: '商人背包',
            startX: 164,
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

        this.playerOfferInventory = new InventoryComponent({ gridWidth: 4, gridHeight: 3 });
        this.merchantOfferInventory = new InventoryComponent({ gridWidth: 4, gridHeight: 3 });

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
        this.playerOfferPane.setInventory(this.playerOfferInventory);
        this.merchantOfferPane.setInventory(this.merchantOfferInventory);
        this.isVisible = true;
        this.dirty = true;
        this.graphics.use(this.background);
        this.registerPanes();
        this.updateDisplay();
    }

    public hide() {
        if (this.isVisible) {
            this.returnOfferItems();
        }
        this.isVisible = false;
        this.playerInventory = null;
        this.merchantInventory = null;
        this.playerOwner = null;
        this.merchantName = '商人';
        this.hideHover();
        this.dragManager.unregisterPane('shop-player');
        this.dragManager.unregisterPane('shop-merchant');
        this.dragManager.unregisterPane('shop-player-offer');
        this.dragManager.unregisterPane('shop-merchant-offer');
        this.graphics.hide();
        this.playerPane.setInventory(null);
        this.merchantPane.setInventory(null);
        this.playerOfferPane.setInventory(null);
        this.merchantOfferPane.setInventory(null);
        this.playerPane.clear();
        this.merchantPane.clear();
        this.playerOfferPane.clear();
        this.merchantOfferPane.clear();
        this.clearStaticSlots();
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
            this.playerOfferPane.render();
            this.merchantOfferPane.render();
        }
    }

    private returnOfferItems() {
        if (this.playerInventory && this.playerOfferInventory) {
            const playerItems = GridContainerSystem.getAllItems(this.playerOfferInventory);
            for (const item of [...playerItems]) {
                GridContainerSystem.transferItem(this.playerOfferInventory, this.playerInventory, item.uid, item.quantity);
            }
        }
        if (this.merchantInventory && this.merchantOfferInventory) {
            const merchantItems = GridContainerSystem.getAllItems(this.merchantOfferInventory);
            for (const item of [...merchantItems]) {
                GridContainerSystem.transferItem(this.merchantOfferInventory, this.merchantInventory, item.uid, item.quantity);
            }
        }
    }

    private calculateOfferValue(container: InventoryComponent, isPlayerOffering: boolean): number {
        const items = GridContainerSystem.getAllItems(container);
        let total = 0;
        for (const item of items) {
            const unitValue = item.id === 'gold_coin' ? 1 : item.value;
            const effectiveValue = isPlayerOffering && item.id !== 'gold_coin'
                ? Math.floor(unitValue / 2)
                : unitValue;
            total += effectiveValue * item.quantity;
        }
        return total;
    }

    private executeTrade() {
        if (!this.playerInventory || !this.merchantInventory) return;

        const playerValue = this.calculateOfferValue(this.playerOfferInventory, true);
        const merchantValue = this.calculateOfferValue(this.merchantOfferInventory, false);

        if (playerValue < merchantValue) {
            console.log('交易失败：你的出价不足');
            return;
        }

        const playerOfferItems = [...GridContainerSystem.getAllItems(this.playerOfferInventory)];
        const merchantOfferItems = [...GridContainerSystem.getAllItems(this.merchantOfferInventory)];

        for (const item of playerOfferItems) {
            GridContainerSystem.transferItem(this.playerOfferInventory, this.merchantInventory, item.uid, item.quantity);
        }

        for (const item of merchantOfferItems) {
            GridContainerSystem.transferItem(this.merchantOfferInventory, this.playerInventory, item.uid, item.quantity);
        }

        this.dirty = true;
        this.updateDisplay();
        console.log('交易成功！');
    }

    private updateDisplay() {
        if (!this.isVisible) return;

        this.playerPane.render();
        this.merchantPane.render();
        this.playerOfferPane.render();
        this.merchantOfferPane.render();

        this.clearStaticSlots();

        const playerValue = this.calculateOfferValue(this.playerOfferInventory, true);
        const merchantValue = this.calculateOfferValue(this.merchantOfferInventory, false);
        const canTrade = playerValue >= merchantValue;

        this.valueLabel = new ex.Label({
            text: `你的出价: ${playerValue}  |  商人出价: ${merchantValue}`,
            font: new ex.Font({
                family: 'Arial',
                size: 16,
                color: canTrade ? ex.Color.fromHex('#7cfc00') : ex.Color.fromHex('#ff6b6b'),
                textAlign: ex.TextAlign.Center
            }),
            pos: ex.vec(0, 50),
            z: 1201
        });
        this.addChild(this.valueLabel);
        this.staticSlots.push(this.valueLabel);

        this.tradeButton = new ex.Actor({
            pos: ex.vec(0, 90),
            width: 140,
            height: 38,
            z: 1201
        });

        const btnColor = canTrade ? ex.Color.fromHex('#4a7c3f') : ex.Color.fromHex('#5a3a3a');
        const btnStroke = canTrade ? ex.Color.fromHex('#7cfc00') : ex.Color.fromHex('#ff6b6b');

        this.tradeButton.graphics.use(new ex.Rectangle({
            width: 140,
            height: 38,
            color: btnColor,
            strokeColor: btnStroke,
            lineWidth: 2
        }));

        const btnLabel = new ex.Label({
            text: '交易',
            font: new ex.Font({
                family: 'Arial',
                size: 18,
                color: ex.Color.White,
                textAlign: ex.TextAlign.Center
            }),
            pos: ex.vec(0, 0),
            z: 1202
        });
        this.tradeButton.addChild(btnLabel);

        if (canTrade) {
            this.tradeButton.on('pointerdown', () => this.executeTrade());
        }

        this.addChild(this.tradeButton);
        this.staticSlots.push(this.tradeButton);

        this.addHint('把物品放入交换区进行议价', 0, -130, 14, ex.Color.fromHex('#d7c5a3'));
        this.addHint('非金币物品卖给商人时价值减半', 0, 120, 12, ex.Color.fromHex('#b8a98d'));
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
        this.valueLabel = null;
        this.tradeButton = null;
    }

    private showHover(item: ItemBase, localPos: ex.Vector) {
        const unitValue = item.id === 'gold_coin' ? 1 : item.value;
        const sellValue = item.id === 'gold_coin' ? 1 : Math.floor(item.value / 2);
        const valueText = item.id === 'gold_coin'
            ? `价值: 1`
            : `标准价值: ${unitValue}  商人出价: ${sellValue}`;
        this.hoverTooltip.show(
            `${item.name}\n${item.description}\n数量: ${item.quantity}\n${valueText}`,
            localPos,
            ex.vec(128, 64)
        );
    }

    private hideHover() {
        this.hoverTooltip.hide();
    }

    private registerPanes() {
        this.dragManager.registerPane({
            id: 'shop-player',
            pane: this.playerPane,
            getContainer: () => this.playerInventory,
            screenToLocal: (screenPos) => screenPos.sub(this.pos),
            localToScreen: (localPos) => this.pos.add(localPos),
            canAcceptDrop: (sourcePaneId) => sourcePaneId === 'shop-player-offer',
            onHover: (ctx) => {
                if (!ctx.item) { this.hideHover(); return; }
                this.showHover(ctx.item, ctx.localPos);
            },
            onChanged: () => { this.dirty = true; this.updateDisplay(); },
            isActive: () => this.isVisible
        });

        this.dragManager.registerPane({
            id: 'shop-merchant',
            pane: this.merchantPane,
            getContainer: () => this.merchantInventory,
            screenToLocal: (screenPos) => screenPos.sub(this.pos),
            localToScreen: (localPos) => this.pos.add(localPos),
            canAcceptDrop: (sourcePaneId) => sourcePaneId === 'shop-merchant-offer',
            onHover: (ctx) => {
                if (!ctx.item) { this.hideHover(); return; }
                this.showHover(ctx.item, ctx.localPos);
            },
            onChanged: () => { this.dirty = true; this.updateDisplay(); },
            isActive: () => this.isVisible
        });

        this.dragManager.registerPane({
            id: 'shop-player-offer',
            pane: this.playerOfferPane,
            getContainer: () => this.playerOfferInventory,
            screenToLocal: (screenPos) => screenPos.sub(this.pos),
            localToScreen: (localPos) => this.pos.add(localPos),
            canAcceptDrop: (sourcePaneId) => sourcePaneId === 'shop-player',
            onHover: (ctx) => {
                if (!ctx.item) { this.hideHover(); return; }
                this.showHover(ctx.item, ctx.localPos);
            },
            onChanged: () => { this.dirty = true; this.updateDisplay(); },
            isActive: () => this.isVisible
        });

        this.dragManager.registerPane({
            id: 'shop-merchant-offer',
            pane: this.merchantOfferPane,
            getContainer: () => this.merchantOfferInventory,
            screenToLocal: (screenPos) => screenPos.sub(this.pos),
            localToScreen: (localPos) => this.pos.add(localPos),
            canAcceptDrop: (sourcePaneId) => sourcePaneId === 'shop-merchant',
            onHover: (ctx) => {
                if (!ctx.item) { this.hideHover(); return; }
                this.showHover(ctx.item, ctx.localPos);
            },
            onChanged: () => { this.dirty = true; this.updateDisplay(); },
            isActive: () => this.isVisible
        });
    }
}
