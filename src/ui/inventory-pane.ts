import * as ex from 'excalibur';
import { GridContainerComponent } from '../components/grid-container-component';
import { ItemBase, ItemType } from '../item-base';
import { GridContainerSystem } from '../systems/grid-container-system';

type InventoryPaneStyle = {
    slotColor: ex.Color;
    slotStrokeColor: ex.Color;
    itemStrokeColor: ex.Color;
    titleColor: ex.Color;
    quantityColor: ex.Color;
    labelColor: ex.Color;
};

type InventoryPaneOptions = {
    title: string;
    startX: number;
    startY: number;
    headerY: number;
    slotSize: number;
    slotMargin: number;
    gridWidth: number;
    gridHeight: number;
    zBase: number;
    style: InventoryPaneStyle;
};

const DEFAULT_STYLE: InventoryPaneStyle = {
    slotColor: ex.Color.fromHex('#666666'),
    slotStrokeColor: ex.Color.White,
    itemStrokeColor: ex.Color.White,
    titleColor: ex.Color.White,
    quantityColor: ex.Color.Yellow,
    labelColor: ex.Color.White
};

// 通用库存面板：只负责单个库存区域的绘制与命中检测，
// 具体的拖拽、跨面板转移、右键使用等交互由上层 UI 组合控制。
export class InventoryPane {
    private readonly root: ex.Actor;
    private readonly itemSlots: ex.Actor[] = [];
    private container: GridContainerComponent | null = null;
    private title: string;
    private lastRenderKey: string | null = null;

    private readonly startX: number;
    private readonly startY: number;
    private readonly headerY: number;
    private readonly slotSize: number;
    private readonly slotMargin: number;
    private readonly gridWidth: number;
    private readonly gridHeight: number;
    private readonly zBase: number;
    private readonly style: InventoryPaneStyle;

    constructor(options: InventoryPaneOptions) {
        this.title = options.title;
        this.startX = options.startX;
        this.startY = options.startY;
        this.headerY = options.headerY;
        this.slotSize = options.slotSize;
        this.slotMargin = options.slotMargin;
        this.gridWidth = options.gridWidth;
        this.gridHeight = options.gridHeight;
        this.zBase = options.zBase;
        this.style = options.style;

        this.root = new ex.Actor({
            pos: ex.vec(0, 0),
            z: 1000
        });
    }

    public attachTo(parent: ex.Actor) {
        parent.addChild(this.root);
    }

    // 保留 setInventory 命名用于兼容现有 UI 调用方。
    public setInventory(container: GridContainerComponent | null) {
        if (this.container !== container) {
            this.lastRenderKey = null;
        }
        this.container = container;
    }

    public setContainer(container: GridContainerComponent | null) {
        if (this.container !== container) {
            this.lastRenderKey = null;
        }
        this.container = container;
    }

    public setTitle(title: string) {
        if (this.title !== title) {
            this.lastRenderKey = null;
        }
        this.title = title;
    }

    public render() {
        const renderKey = this.createRenderKey();
        if (renderKey === this.lastRenderKey) {
            return;
        }

        this.clear();
        this.renderTitle();
        this.renderGrid();
        this.renderItems();
        this.lastRenderKey = renderKey;
    }

    public clear() {
        this.itemSlots.forEach(slot => this.root.removeChild(slot));
        this.itemSlots.length = 0;
        this.lastRenderKey = null;
    }

    public findItemAt(localPos: ex.Vector): ItemBase | null {
        if (!this.container) {
            return null;
        }

        for (const item of GridContainerSystem.getAllItems(this.container)) {
            if (item.inventoryX === undefined || item.inventoryY === undefined) {
                continue;
            }

            const itemLeft = this.startX + item.inventoryX * (this.slotSize + this.slotMargin);
            const itemTop = this.startY + item.inventoryY * (this.slotSize + this.slotMargin);
            const itemRight = itemLeft + item.width * (this.slotSize + this.slotMargin) - this.slotMargin;
            const itemBottom = itemTop + item.height * (this.slotSize + this.slotMargin) - this.slotMargin;

            if (localPos.x >= itemLeft && localPos.x <= itemRight && localPos.y >= itemTop && localPos.y <= itemBottom) {
                return item;
            }
        }

        return null;
    }

    public isPointInside(localPos: ex.Vector): boolean {
        return localPos.x >= this.startX
            && localPos.x <= this.startX + this.getPixelWidth()
            && localPos.y >= this.startY
            && localPos.y <= this.startY + this.getPixelHeight();
    }

    public getGridX(localPos: ex.Vector): number {
        return Math.floor((localPos.x - this.startX) / (this.slotSize + this.slotMargin));
    }

    public getGridY(localPos: ex.Vector): number {
        return Math.floor((localPos.y - this.startY) / (this.slotSize + this.slotMargin));
    }

    public getItemAnchor(item: ItemBase): ex.Vector {
        return ex.vec(
            this.startX + (item.inventoryX || 0) * (this.slotSize + this.slotMargin) + item.width * this.slotSize / 2,
            this.startY + (item.inventoryY || 0) * (this.slotSize + this.slotMargin) + item.height * this.slotSize / 2
        );
    }

    public getItemPixelWidth(item: ItemBase): number {
        return item.width * this.slotSize;
    }

    public getItemPixelHeight(item: ItemBase): number {
        return item.height * this.slotSize;
    }

    public getItemColor(item: ItemBase): ex.Color {
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

    public static createStyle(style: Partial<InventoryPaneStyle>): InventoryPaneStyle {
        return { ...DEFAULT_STYLE, ...style };
    }

    private renderTitle() {
        const titleLabel = new ex.Label({
            text: this.title,
            font: new ex.Font({
                family: 'Arial',
                size: 22,
                color: this.style.titleColor,
                textAlign: ex.TextAlign.Center
            }),
            pos: ex.vec(this.startX + this.getPixelWidth() / 2, this.headerY),
            z: this.zBase + 1
        });

        this.root.addChild(titleLabel);
        this.itemSlots.push(titleLabel);
    }

    private renderGrid() {
        for (let row = 0; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                const slotX = this.startX + col * (this.slotSize + this.slotMargin);
                const slotY = this.startY + row * (this.slotSize + this.slotMargin);
                const slotBg = new ex.Actor({
                    pos: ex.vec(slotX + this.slotSize / 2, slotY + this.slotSize / 2),
                    width: this.slotSize,
                    height: this.slotSize,
                    z: this.zBase + 1
                });

                slotBg.graphics.use(new ex.Rectangle({
                    width: this.slotSize,
                    height: this.slotSize,
                    color: this.style.slotColor,
                    strokeColor: this.style.slotStrokeColor,
                    lineWidth: 1
                }));

                this.root.addChild(slotBg);
                this.itemSlots.push(slotBg);
            }
        }
    }

    private renderItems() {
        if (!this.container) {
            return;
        }

        for (const item of GridContainerSystem.getAllItems(this.container)) {
            if (item.inventoryX === undefined || item.inventoryY === undefined) {
                continue;
            }

            const itemX = this.startX + item.inventoryX * (this.slotSize + this.slotMargin);
            const itemY = this.startY + item.inventoryY * (this.slotSize + this.slotMargin);
            const itemIcon = new ex.Actor({
                pos: ex.vec(itemX + item.width * this.slotSize / 2, itemY + item.height * this.slotSize / 2),
                width: item.width * this.slotSize,
                height: item.height * this.slotSize,
                z: this.zBase + 2
            });

            itemIcon.graphics.use(new ex.Rectangle({
                width: item.width * this.slotSize,
                height: item.height * this.slotSize,
                color: this.getItemColor(item),
                strokeColor: this.style.itemStrokeColor,
                lineWidth: 1
            }));

            this.root.addChild(itemIcon);
            this.itemSlots.push(itemIcon);

            const nameLabel = new ex.Label({
                text: item.name,
                font: new ex.Font({
                    family: 'Arial',
                    size: 10,
                    color: this.style.labelColor,
                    textAlign: ex.TextAlign.Center
                }),
                pos: ex.vec(itemX + item.width * this.slotSize / 2, itemY + item.height * this.slotSize / 2 - 6),
                z: this.zBase + 3
            });
            this.root.addChild(nameLabel);
            this.itemSlots.push(nameLabel);

            if (item.stackable && item.quantity > 1) {
                const quantityLabel = new ex.Label({
                    text: item.quantity.toString(),
                    font: new ex.Font({
                        family: 'Arial',
                        size: 12,
                        color: this.style.quantityColor,
                        textAlign: ex.TextAlign.Right
                    }),
                    pos: ex.vec(itemX + item.width * this.slotSize - 10, itemY + item.height * this.slotSize - 10),
                    z: this.zBase + 3
                });
                this.root.addChild(quantityLabel);
                this.itemSlots.push(quantityLabel);
            }
        }
    }

    private getPixelWidth(): number {
        return this.gridWidth * (this.slotSize + this.slotMargin) - this.slotMargin;
    }

    private getPixelHeight(): number {
        return this.gridHeight * (this.slotSize + this.slotMargin) - this.slotMargin;
    }

    /**
     * 生成当前面板的渲染快照键：
     * - 标题变化会触发重绘
     * - 容器引用切换会触发重绘
     * - 物品的摆放、尺寸、数量变化会触发重绘
     *
     * 这样即使上层每帧调用 render，只要内容未变化，就不会反复销毁/重建 UI Actor。
     */
    private createRenderKey(): string {
        if (!this.container) {
            return `${this.title}|empty`;
        }

        const items = GridContainerSystem.getAllItems(this.container)
            .map((item) => [
                item.uid,
                item.inventoryX ?? -1,
                item.inventoryY ?? -1,
                item.width,
                item.height,
                item.quantity,
                item.rotated ? 1 : 0,
                item.name
            ].join(':'))
            .sort();

        return [
            this.title,
            this.container.kind,
            this.container.gridWidth,
            this.container.gridHeight,
            items.join('|')
        ].join('#');
    }
}