import * as ex from 'excalibur';
import { InventoryComponent } from '../components/inventory-component';
import { ItemBase } from '../item-base';
import { InventorySystem } from '../systems/inventory-system';
import { InventoryPane } from './inventory-pane';
import { HoverTooltip } from './hover-tooltip';
import { getSharedInventoryDragManager } from './inventory-drag-manager';

export class InventoryUI extends ex.ScreenElement {
    private inventory: InventoryComponent | null = null;
    private owner: ex.Entity | null = null;
    private background: ex.Rectangle;
    private readonly pane: InventoryPane;
    private readonly dragManager;
    private isVisible: boolean = false;

    private readonly hoverTooltip: HoverTooltip;

    private readonly SLOT_SIZE = 48;
    private readonly SLOT_MARGIN = 4;
    private readonly GRID_WIDTH = 8;
    private readonly GRID_HEIGHT = 5;
    private readonly GRID_START_X = -205;
    private readonly GRID_START_Y = -120;
    private readonly HEADER_Y = -155;

    constructor(engine: ex.Engine) {
        const gridWidth = 8 * (48 + 4) - 4;
        const gridHeight = 5 * (48 + 4) - 4;
        const titleHeight = 40;
        const padding = 20;

        super({
            x: 400,
            y: 300,
            width: gridWidth + padding * 2,
            height: gridHeight + titleHeight + padding * 2,
            anchor: ex.Vector.Half,
            z: 1000
        });

        this.background = new ex.Rectangle({
            width: gridWidth + padding * 2,
            height: gridHeight + titleHeight + padding * 2,
            color: ex.Color.fromHex('#333333'),
            strokeColor: ex.Color.White,
            lineWidth: 2
        });

        this.pane = new InventoryPane({
            title: '库存',
            startX: this.GRID_START_X,
            startY: this.GRID_START_Y,
            headerY: this.HEADER_Y,
            slotSize: this.SLOT_SIZE,
            slotMargin: this.SLOT_MARGIN,
            gridWidth: this.GRID_WIDTH,
            gridHeight: this.GRID_HEIGHT,
            zBase: 1001,
            style: InventoryPane.createStyle({})
        });
        this.pane.attachTo(this);

        this.dragManager = getSharedInventoryDragManager(engine);

        this.hoverTooltip = new HoverTooltip({
            width: 220,
            height: 70,
            textOffsetX: 10,
            textOffsetY: 10
        });
        this.hoverTooltip.attachTo(this);
    }

    setInventory(inventory: InventoryComponent) {
        if (this.inventory === inventory) {
            return;
        }
        this.inventory = inventory;
        this.pane.setInventory(inventory);
        if (this.isVisible) {
            this.updateDisplay();
        }
    }

    setOwner(owner: ex.Entity) {
        this.owner = owner;
    }

    public isOpen(): boolean {
        return this.isVisible;
    }

    show() {
        this.isVisible = true;
        this.graphics.use(this.background);
        this.registerPane();
        this.updateDisplay();
    }

    hide() {
        this.isVisible = false;
        this.hideHover();
        this.dragManager.unregisterPane('inventory-main');
        this.graphics.hide();
        this.pane.clear();
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    private showHover(item: ItemBase, localPos: ex.Vector) {
        this.hoverTooltip.show(
            `${item.name}\n${item.description}\n数量: ${item.quantity}`,
            localPos,
            ex.vec(110, 60)
        );
    }

    private hideHover() {
        this.hoverTooltip.hide();
    }

    private updateDisplay() {
        if (!this.inventory || !this.isVisible) {
            return;
        }

        this.pane.setInventory(this.inventory);
        this.pane.render();
    }

    private registerPane() {
        this.dragManager.registerPane({
            id: 'inventory-main',
            pane: this.pane,
            getContainer: () => this.inventory,
            screenToLocal: (screenPos) => screenPos.sub(this.pos),
            localToScreen: (localPos) => this.pos.add(localPos),
            onHover: (ctx) => {
                if (!ctx.item) {
                    this.hideHover();
                    return;
                }

                this.showHover(ctx.item, ctx.localPos);
            },
            onRightClick: (ctx) => {
                if (!this.inventory || !this.owner) {
                    return;
                }

                InventorySystem.addUseRequest(this.inventory, ctx.item.uid, this.owner);
                console.log(`标记道具使用请求：${ctx.item.name}`);
                (ctx.event as any).preventDefault?.();
                this.updateDisplay();
            },
            onChanged: () => {
                this.updateDisplay();
            },
            isActive: () => this.isVisible
        });
    }
}