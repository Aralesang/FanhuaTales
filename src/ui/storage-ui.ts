import * as ex from 'excalibur';
import { InventoryComponent } from '../components/inventory-component';
import { ItemBase, ItemType } from '../item-base';
import { InventorySystem } from '../systems/inventory-system';

type StoragePane = 'player' | 'storage';

export class StorageUI extends ex.ScreenElement {
    private playerInventory: InventoryComponent | null = null;
    private storageInventory: InventoryComponent | null = null;
    private playerOwner: ex.Entity | null = null;
    private storageTitle: string = '箱子';
    private background: ex.Rectangle;
    private itemSlots: ex.Actor[] = [];
    private isVisible: boolean = false;

    private draggedItem: ItemBase | null = null;
    private draggedActor: ex.Actor | null = null;
    private dragOffset: ex.Vector = ex.Vector.Zero;
    private dragSourcePane: StoragePane | null = null;
    private isDragging: boolean = false;

    // 脏标记：仅当库存数据发生变化时才重建 UI，避免每帧重建导致卡顿。
    private dirty: boolean = false;

    private hoverPanel: ex.Actor | null = null;
    private hoverLabel: ex.Label | null = null;

    private readonly SLOT_SIZE = 40;
    private readonly SLOT_MARGIN = 4;
    private readonly GRID_WIDTH = 8;
    private readonly GRID_HEIGHT = 5;
    private readonly PLAYER_GRID_START_X = -364;
    private readonly STORAGE_GRID_START_X = 16;
    private readonly GRID_START_Y = -112;
    private readonly HEADER_Y = -150;

    constructor() {
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

        this.on('pointerdown', (evt) => this.onPointerDown(evt));
        this.on('pointermove', (evt) => this.onPointerMove(evt));
        this.on('pointerup', (evt) => this.onPointerUp(evt));

        this.hoverPanel = new ex.Actor({
            pos: ex.vec(0, 0),
            width: 240,
            height: 74,
            z: 1300
        });
        this.hoverPanel.graphics.use(new ex.Rectangle({
            width: 240,
            height: 74,
            color: ex.Color.fromHex('#111111dd'),
            strokeColor: ex.Color.White,
            lineWidth: 1
        }));
        this.hoverPanel.graphics.opacity = 0;

        this.hoverLabel = new ex.Label({
            text: '',
            font: new ex.Font({ family: 'Arial', size: 14, color: ex.Color.White }),
            pos: ex.vec(-108, -26),
            z: 1301
        });
        this.hoverPanel.addChild(this.hoverLabel);
        this.addChild(this.hoverPanel);
    }

    public show(playerOwner: ex.Entity, playerInventory: InventoryComponent, storageInventory: InventoryComponent, storageTitle: string) {
        this.playerOwner = playerOwner;
        this.playerInventory = playerInventory;
        this.storageInventory = storageInventory;
        this.storageTitle = storageTitle;
        this.isVisible = true;
        this.dirty = true;
        this.graphics.use(this.background);
        this.updateDisplay();
    }

    public hide() {
        this.isVisible = false;
        this.playerInventory = null;
        this.storageInventory = null;
        this.playerOwner = null;
        this.storageTitle = '箱子';
        this.hideHover();
        this.clearDragState(false);
        this.graphics.hide();
        this.itemSlots.forEach(slot => this.removeChild(slot));
        this.itemSlots = [];
    }

    public refresh() {
        if (this.isVisible && this.dirty) {
            this.dirty = false;
            this.updateDisplay();
        }
    }

    // 外部在修改库存数据后调用，标记 UI 需要刷新。
    public markDirty() {
        this.dirty = true;
    }

    public isOpen(): boolean {
        return this.isVisible;
    }

    private onPointerDown(evt: ex.PointerEvent) {
        if (!this.playerInventory || !this.storageInventory || !this.isVisible) {
            return;
        }

        const localPos = evt.screenPos.sub(this.pos);
        const hit = this.findItemAt(localPos);
        if (!hit) {
            return;
        }

        const isRightClick = (evt.button as any) === ex.PointerButton.Right || (evt.button as any) === 'Right';
        if (isRightClick && hit.pane === 'player' && this.playerOwner) {
            InventorySystem.addUseRequest(this.playerInventory, hit.item.uid, this.playerOwner);
            this.dirty = true;
            (evt as any).preventDefault?.();
            return;
        }

        this.startDrag(hit.item, hit.pane, localPos);
    }

    private onPointerMove(evt: ex.PointerEvent) {
        const localPos = evt.screenPos.sub(this.pos);
        if (this.isDragging && this.draggedActor) {
            this.draggedActor.pos = localPos.sub(this.dragOffset);
            return;
        }
        this.updateHover(localPos);
    }

    private onPointerUp(evt: ex.PointerEvent) {
        if (!this.isDragging || !this.draggedItem || !this.draggedActor) {
            return;
        }
        const localPos = evt.screenPos.sub(this.pos);
        this.endDrag(localPos);
    }

    private startDrag(item: ItemBase, pane: StoragePane, mousePos: ex.Vector) {
        const inventory = this.getInventoryByPane(pane);
        const panelStartX = pane === 'player' ? this.PLAYER_GRID_START_X : this.STORAGE_GRID_START_X;
        if (!inventory) {
            return;
        }

        this.draggedItem = item;
        this.dragSourcePane = pane;
        this.isDragging = true;

        const itemScreenX = panelStartX + (item.inventoryX || 0) * (this.SLOT_SIZE + this.SLOT_MARGIN);
        const itemScreenY = this.GRID_START_Y + (item.inventoryY || 0) * (this.SLOT_SIZE + this.SLOT_MARGIN);

        this.draggedActor = new ex.Actor({
            pos: ex.vec(itemScreenX + item.width * this.SLOT_SIZE / 2, itemScreenY + item.height * this.SLOT_SIZE / 2),
            width: item.width * this.SLOT_SIZE,
            height: item.height * this.SLOT_SIZE,
            z: 1250
        });

        this.draggedActor.graphics.use(new ex.Rectangle({
            width: item.width * this.SLOT_SIZE,
            height: item.height * this.SLOT_SIZE,
            color: this.getItemColor(item),
            strokeColor: ex.Color.White,
            lineWidth: 2
        }));

        this.dragOffset = mousePos.sub(this.draggedActor.pos);
        this.addChild(this.draggedActor);
        InventorySystem.removeItemFromGrid(inventory, item);
    }

    private endDrag(mousePos: ex.Vector) {
        if (!this.draggedItem || !this.draggedActor || !this.dragSourcePane) {
            return;
        }

        const sourceInventory = this.getInventoryByPane(this.dragSourcePane);
        const targetPane = this.getPaneAt(mousePos);
        let handled = false;

        if (sourceInventory && targetPane) {
            const targetInventory = this.getInventoryByPane(targetPane);
            if (targetInventory) {
                if (targetPane === this.dragSourcePane) {
                    const gridX = this.getGridX(targetPane, mousePos);
                    const gridY = this.getGridY(mousePos);
                    if (InventorySystem.isGridPositionFree(targetInventory, gridX, gridY, this.draggedItem.width, this.draggedItem.height)) {
                        InventorySystem.placeItem(targetInventory, this.draggedItem.uid, gridX, gridY);
                        handled = true;
                    }
                } else if (InventorySystem.transferItem(sourceInventory, targetInventory, this.draggedItem.uid)) {
                    handled = true;
                }
            }
        }

        if (!handled && sourceInventory) {
            InventorySystem.placeItemOnGrid(sourceInventory, this.draggedItem);
        }

        this.clearDragState(true);
        this.dirty = true;
        this.updateDisplay();
    }

    private clearDragState(removeDraggedActor: boolean) {
        if (removeDraggedActor && this.draggedActor) {
            this.removeChild(this.draggedActor);
        }
        this.draggedActor = null;
        this.draggedItem = null;
        this.dragSourcePane = null;
        this.dragOffset = ex.Vector.Zero;
        this.isDragging = false;
    }

    private findItemAt(localPos: ex.Vector): { item: ItemBase; pane: StoragePane } | null {
        const playerHit = this.findItemInPane(localPos, 'player');
        if (playerHit) {
            return playerHit;
        }
        return this.findItemInPane(localPos, 'storage');
    }

    private findItemInPane(localPos: ex.Vector, pane: StoragePane): { item: ItemBase; pane: StoragePane } | null {
        const inventory = this.getInventoryByPane(pane);
        const panelStartX = pane === 'player' ? this.PLAYER_GRID_START_X : this.STORAGE_GRID_START_X;
        if (!inventory) {
            return null;
        }

        const items = InventorySystem.getAllItems(inventory);
        for (const item of items) {
            if (item.inventoryX === undefined || item.inventoryY === undefined) {
                continue;
            }

            const itemLeft = panelStartX + item.inventoryX * (this.SLOT_SIZE + this.SLOT_MARGIN);
            const itemTop = this.GRID_START_Y + item.inventoryY * (this.SLOT_SIZE + this.SLOT_MARGIN);
            const itemRight = itemLeft + item.width * (this.SLOT_SIZE + this.SLOT_MARGIN) - this.SLOT_MARGIN;
            const itemBottom = itemTop + item.height * (this.SLOT_SIZE + this.SLOT_MARGIN) - this.SLOT_MARGIN;

            if (localPos.x >= itemLeft && localPos.x <= itemRight && localPos.y >= itemTop && localPos.y <= itemBottom) {
                return { item, pane };
            }
        }

        return null;
    }

    private getPaneAt(localPos: ex.Vector): StoragePane | null {
        if (this.isPointInsidePane(localPos, 'player')) {
            return 'player';
        }
        if (this.isPointInsidePane(localPos, 'storage')) {
            return 'storage';
        }
        return null;
    }

    private isPointInsidePane(localPos: ex.Vector, pane: StoragePane): boolean {
        const startX = pane === 'player' ? this.PLAYER_GRID_START_X : this.STORAGE_GRID_START_X;
        const width = this.GRID_WIDTH * (this.SLOT_SIZE + this.SLOT_MARGIN) - this.SLOT_MARGIN;
        const height = this.GRID_HEIGHT * (this.SLOT_SIZE + this.SLOT_MARGIN) - this.SLOT_MARGIN;
        return localPos.x >= startX && localPos.x <= startX + width && localPos.y >= this.GRID_START_Y && localPos.y <= this.GRID_START_Y + height;
    }

    private getGridX(pane: StoragePane, localPos: ex.Vector): number {
        const startX = pane === 'player' ? this.PLAYER_GRID_START_X : this.STORAGE_GRID_START_X;
        return Math.floor((localPos.x - startX) / (this.SLOT_SIZE + this.SLOT_MARGIN));
    }

    private getGridY(localPos: ex.Vector): number {
        return Math.floor((localPos.y - this.GRID_START_Y) / (this.SLOT_SIZE + this.SLOT_MARGIN));
    }

    private updateHover(localPos: ex.Vector) {
        if (!this.isVisible) {
            return;
        }

        const hit = this.findItemAt(localPos);
        if (hit) {
            this.showHover(hit.item, localPos);
            return;
        }
        this.hideHover();
    }

    private showHover(item: ItemBase, localPos: ex.Vector) {
        if (!this.hoverPanel || !this.hoverLabel) {
            return;
        }

        this.hoverLabel.text = `${item.name}\n${item.description}\n数量: ${item.quantity}`;
        this.hoverPanel.pos = ex.vec(localPos.x + 128, localPos.y + 64);
        this.hoverPanel.graphics.opacity = 1;
    }

    private hideHover() {
        if (this.hoverPanel) {
            this.hoverPanel.graphics.opacity = 0;
        }
    }

    private updateDisplay() {
        if (!this.playerInventory || !this.storageInventory || !this.isVisible) {
            return;
        }

        this.itemSlots.forEach(slot => this.removeChild(slot));
        this.itemSlots = [];

        this.addTitle('玩家背包', this.PLAYER_GRID_START_X + 120, this.HEADER_Y);
        this.addTitle(this.storageTitle, this.STORAGE_GRID_START_X + 120, this.HEADER_Y);
        this.addHint('拖动物品可在两边转移，右键玩家物品可使用', 0, 146, 18, ex.Color.fromHex('#d7c5a3'));

        this.renderPane(this.playerInventory, 'player');
        this.renderPane(this.storageInventory, 'storage');
    }

    private renderPane(inventory: InventoryComponent, pane: StoragePane) {
        const paneStartX = pane === 'player' ? this.PLAYER_GRID_START_X : this.STORAGE_GRID_START_X;

        for (let row = 0; row < this.GRID_HEIGHT; row++) {
            for (let col = 0; col < this.GRID_WIDTH; col++) {
                const slotX = paneStartX + col * (this.SLOT_SIZE + this.SLOT_MARGIN);
                const slotY = this.GRID_START_Y + row * (this.SLOT_SIZE + this.SLOT_MARGIN);
                const slotBg = new ex.Actor({
                    pos: ex.vec(slotX + this.SLOT_SIZE / 2, slotY + this.SLOT_SIZE / 2),
                    width: this.SLOT_SIZE,
                    height: this.SLOT_SIZE,
                    z: 1201
                });

                slotBg.graphics.use(new ex.Rectangle({
                    width: this.SLOT_SIZE,
                    height: this.SLOT_SIZE,
                    color: ex.Color.fromHex('#4a443c'),
                    strokeColor: ex.Color.fromHex('#b8a98d'),
                    lineWidth: 1
                }));

                this.addChild(slotBg);
                this.itemSlots.push(slotBg);
            }
        }

        for (const item of InventorySystem.getAllItems(inventory)) {
            if (item.inventoryX === undefined || item.inventoryY === undefined) {
                continue;
            }

            const itemX = paneStartX + item.inventoryX * (this.SLOT_SIZE + this.SLOT_MARGIN);
            const itemY = this.GRID_START_Y + item.inventoryY * (this.SLOT_SIZE + this.SLOT_MARGIN);
            const itemIcon = new ex.Actor({
                pos: ex.vec(itemX + item.width * this.SLOT_SIZE / 2, itemY + item.height * this.SLOT_SIZE / 2),
                width: item.width * this.SLOT_SIZE,
                height: item.height * this.SLOT_SIZE,
                z: 1202
            });

            itemIcon.graphics.use(new ex.Rectangle({
                width: item.width * this.SLOT_SIZE,
                height: item.height * this.SLOT_SIZE,
                color: this.getItemColor(item),
                strokeColor: ex.Color.White,
                lineWidth: 1
            }));

            this.addChild(itemIcon);
            this.itemSlots.push(itemIcon);

            const nameLabel = new ex.Label({
                text: item.name,
                font: new ex.Font({
                    family: 'Arial',
                    size: 10,
                    color: ex.Color.White,
                    textAlign: ex.TextAlign.Center
                }),
                pos: ex.vec(itemX + item.width * this.SLOT_SIZE / 2, itemY + item.height * this.SLOT_SIZE / 2 - 6),
                z: 1203
            });
            this.addChild(nameLabel);
            this.itemSlots.push(nameLabel);

            if (item.stackable && item.quantity > 1) {
                const quantityLabel = new ex.Label({
                    text: item.quantity.toString(),
                    font: new ex.Font({
                        family: 'Arial',
                        size: 12,
                        color: ex.Color.Yellow,
                        textAlign: ex.TextAlign.Right
                    }),
                    pos: ex.vec(itemX + item.width * this.SLOT_SIZE - 10, itemY + item.height * this.SLOT_SIZE - 10),
                    z: 1203
                });
                this.addChild(quantityLabel);
                this.itemSlots.push(quantityLabel);
            }
        }
    }

    private addTitle(text: string, x: number, y: number) {
        const titleLabel = new ex.Label({
            text,
            font: new ex.Font({
                family: 'Arial',
                size: 22,
                color: ex.Color.White,
                textAlign: ex.TextAlign.Center
            }),
            pos: ex.vec(x, y),
            z: 1201
        });
        this.addChild(titleLabel);
        this.itemSlots.push(titleLabel);
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
        this.itemSlots.push(hintLabel);
    }

    private getInventoryByPane(pane: StoragePane): InventoryComponent | null {
        return pane === 'player' ? this.playerInventory : this.storageInventory;
    }

    private getItemColor(item: ItemBase): ex.Color {
        switch (item.type) {
            case ItemType.Consumable:
                return ex.Color.fromHex('#3ba55c');
            case ItemType.Equipment:
                return ex.Color.fromHex('#3c78d8');
            case ItemType.Material:
                return ex.Color.fromHex('#c9a227');
            case ItemType.Key:
                return ex.Color.fromHex('#b33a3a');
            default:
                return ex.Color.Gray;
        }
    }
}