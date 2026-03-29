import * as ex from 'excalibur';
import { InventoryComponent } from '../components/inventory-component';
import { ItemBase } from '../item-base';
import { InventorySystem } from '../systems/inventory-system';
import { InventoryPane } from './inventory-pane';
import { HoverTooltip } from './hover-tooltip';
import { getSharedInventoryDragManager } from './inventory-drag-manager';

/** 存储UI */
export class StorageUI extends ex.ScreenElement {
    private playerInventory: InventoryComponent | null = null;
    private storageInventory: InventoryComponent | null = null;
    private playerOwner: ex.Entity | null = null;
    private storageTitle: string = '箱子';
    private background: ex.Rectangle;
    private staticSlots: ex.Actor[] = [];
    private readonly dragManager;
    private isVisible: boolean = false;

    private dirty: boolean = false;
    private readonly hoverTooltip: HoverTooltip;

    private readonly SLOT_SIZE = 40;
    private readonly SLOT_MARGIN = 4;
    private readonly GRID_WIDTH = 8;
    private readonly GRID_HEIGHT = 5;
    private readonly PLAYER_GRID_START_X = -364;
    private readonly STORAGE_GRID_START_X = 16;
    private readonly GRID_START_Y = -112;
    private readonly HEADER_Y = -150;
    private readonly playerPane: InventoryPane;
    private readonly storagePane: InventoryPane;

    constructor(engine: ex.Engine) {
        const gridWidth = 8 * (40 + 4) - 4;
        const gridHeight = 5 * (40 + 4) - 4;
        const width = gridWidth * 2 + 72;
        const height = gridHeight + 120;

        super({
            x: 400,
            y: 300,
            width,
            height,
            anchor: ex.Vector.Half,
            z: 1200
        });

        this.background = new ex.Rectangle({
            width,
            height,
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
            startX: this.PLAYER_GRID_START_X,
            startY: this.GRID_START_Y,
            headerY: this.HEADER_Y,
            slotSize: this.SLOT_SIZE,
            slotMargin: this.SLOT_MARGIN,
            gridWidth: this.GRID_WIDTH,
            gridHeight: this.GRID_HEIGHT,
            zBase: 1200,
            style: paneStyle
        });
        this.playerPane.attachTo(this);

        this.storagePane = new InventoryPane({
            title: this.storageTitle,
            startX: this.STORAGE_GRID_START_X,
            startY: this.GRID_START_Y,
            headerY: this.HEADER_Y,
            slotSize: this.SLOT_SIZE,
            slotMargin: this.SLOT_MARGIN,
            gridWidth: this.GRID_WIDTH,
            gridHeight: this.GRID_HEIGHT,
            zBase: 1200,
            style: paneStyle
        });
        this.storagePane.attachTo(this);

        this.dragManager = getSharedInventoryDragManager(engine);

        this.hoverTooltip = new HoverTooltip({
            width: 240,
            height: 74,
            z: 1300,
            textOffsetX: 12,
            textOffsetY: 11
        });
        this.hoverTooltip.attachTo(this);
    }

    public show(playerOwner: ex.Entity, playerInventory: InventoryComponent, storageInventory: InventoryComponent, storageTitle: string) {
        this.playerOwner = playerOwner;
        this.playerInventory = playerInventory;
        this.storageInventory = storageInventory;
        this.storageTitle = storageTitle;
        this.playerPane.setInventory(playerInventory);
        this.playerPane.setTitle('玩家背包');
        this.storagePane.setInventory(storageInventory);
        this.storagePane.setTitle(storageTitle);
        this.isVisible = true;
        this.dirty = true;
        this.graphics.use(this.background);
        this.registerPanes();
        this.updateDisplay();
    }

    public hide() {
        this.isVisible = false;
        this.playerInventory = null;
        this.storageInventory = null;
        this.playerOwner = null;
        this.storageTitle = '箱子';
        this.hideHover();
        this.dragManager.unregisterPane('storage-player');
        this.dragManager.unregisterPane('storage-target');
        this.graphics.hide();
        this.playerPane.setInventory(null);
        this.storagePane.setInventory(null);
        this.playerPane.clear();
        this.storagePane.clear();
        this.staticSlots.forEach(slot => this.removeChild(slot));
        this.staticSlots = [];
    }

    public refresh() {
        if (this.isVisible && this.dirty) {
            this.dirty = false;
            this.updateDisplay();
        }
    }

    public markDirty() {
        this.dirty = true;
    }

    public isOpen(): boolean {
        return this.isVisible;
    }

    private showHover(item: ItemBase, localPos: ex.Vector) {
        this.hoverTooltip.show(
            `${item.name}\n${item.description}\n数量: ${item.quantity}`,
            localPos,
            ex.vec(128, 64)
        );
    }

    private hideHover() {
        this.hoverTooltip.hide();
    }

    private updateDisplay() {
        if (!this.playerInventory || !this.storageInventory || !this.isVisible) {
            return;
        }

        this.playerPane.setInventory(this.playerInventory);
        this.playerPane.setTitle('玩家背包');
        this.storagePane.setInventory(this.storageInventory);
        this.storagePane.setTitle(this.storageTitle);
        this.playerPane.render();
        this.storagePane.render();

        this.staticSlots.forEach(slot => this.removeChild(slot));
        this.staticSlots = [];
        this.addHint('拖动物品可在两边转移，右键玩家物品可使用', 0, 146, 18, ex.Color.fromHex('#d7c5a3'));
    }

    private addHint(text: string, x: number, y: number, size: number, color: ex.Color) {
        const hintLabel = new ex.Label({
            text,
            font: new ex.Font({
                family: 'Arial',
                size,
                color,
                textAlign: ex.TextAlign.Center
            }),
            pos: ex.vec(x, y),
            z: 1201
        });
        this.addChild(hintLabel);
        this.staticSlots.push(hintLabel);
    }

    private registerPanes() {
        this.dragManager.registerPane({
            id: 'storage-player',
            pane: this.playerPane,
            getContainer: () => this.playerInventory,
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
                if (!this.playerInventory || !this.playerOwner) {
                    return;
                }

                InventorySystem.addUseRequest(this.playerInventory, ctx.item.uid, this.playerOwner);
                this.dirty = true;
                (ctx.event as any).preventDefault?.();
                this.updateDisplay();
            },
            onChanged: () => {
                this.dirty = true;
                this.updateDisplay();
            },
            isActive: () => this.isVisible
        });

        this.dragManager.registerPane({
            id: 'storage-target',
            pane: this.storagePane,
            getContainer: () => this.storageInventory,
            screenToLocal: (screenPos) => screenPos.sub(this.pos),
            localToScreen: (localPos) => this.pos.add(localPos),
            onHover: (ctx) => {
                if (!ctx.item) {
                    this.hideHover();
                    return;
                }

                this.showHover(ctx.item, ctx.localPos);
            },
            onChanged: () => {
                this.dirty = true;
                this.updateDisplay();
            },
            isActive: () => this.isVisible
        });
    }
}