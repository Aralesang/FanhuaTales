import { GridContainerComponent } from '../components/grid-container-component';
import { ItemBase, generateItemUid } from '../item-base';

/**
 * 通用网格容器系统（静态工具层）：
 * - 负责暗黑风格网格容器的核心算法
 * - 不依赖具体 UI，不关心容器来自背包/箱子/快捷栏
 */
export class GridContainerSystem {
    /** 添加物品到容器（自动寻找可放置位置，支持同类型堆叠）。 */
    public static addItem(container: GridContainerComponent, item: ItemBase): boolean {
        if (!this.canAcceptItem(container, item)) {
            return false;
        }

        if (item.stackable) {
            const existing = this.findItemByTypeId(container, item.id);
            if (existing) {
                if (existing.quantity + item.quantity <= existing.maxStack) {
                    existing.quantity += item.quantity;
                    container.version++;
                    return true;
                }
                return false;
            }
        }

        const position = this.findFreeSpace(container, item.width, item.height);
        if (!position) {
            return false;
        }

        const newItem = this.cloneItem(item, {
            uid: item.uid || generateItemUid(),
            inventoryX: position.x,
            inventoryY: position.y
        });

        this.placeItemOnGrid(container, newItem);
        container.items.set(newItem.uid, newItem);
        container.version++;
        return true;
    }

    /** 在两个容器之间转移物品，支持部分数量转移。 */
    public static transferItem(source: GridContainerComponent, target: GridContainerComponent, itemUid: string, quantity?: number): boolean {
        const item = source.items.get(itemUid);
        if (!item) {
            return false;
        }

        const transferQuantity = Math.min(quantity ?? item.quantity, item.quantity);
        const movedItem = this.cloneItem(item, {
            quantity: transferQuantity,
            inventoryX: undefined,
            inventoryY: undefined
        });

        if (!this.addItem(target, movedItem)) {
            return false;
        }

        return this.removeItem(source, itemUid, transferQuantity);
    }

    /**
     * 在两个容器之间按指定格坐标转移物品。
     * 该方法用于拖拽放置：只有目标落点可放置时才会真正完成转移。
     */
    public static transferItemToPosition(source: GridContainerComponent, target: GridContainerComponent, itemUid: string, x: number, y: number, quantity?: number): boolean {
        const item = source.items.get(itemUid);
        if (!item) {
            return false;
        }

        const transferQuantity = Math.min(quantity ?? item.quantity, item.quantity);
        const movedItem = this.cloneItem(item, {
            quantity: transferQuantity,
            inventoryX: x,
            inventoryY: y
        });

        if (!this.canAcceptItem(target, movedItem)) {
            return false;
        }

        if (!this.isGridPositionFree(target, x, y, movedItem.width, movedItem.height)) {
            return false;
        }

        this.placeItemOnGrid(target, movedItem);
        target.items.set(movedItem.uid, movedItem);
        target.version++;
        return this.removeItem(source, itemUid, transferQuantity);
    }

    /** 将物品实例移动到指定网格位置。 */
    public static placeItem(container: GridContainerComponent, itemUid: string, x: number, y: number): boolean {
        const item = container.items.get(itemUid);
        if (!item) {
            return false;
        }

        const originX = item.inventoryX;
        const originY = item.inventoryY;

        this.removeItemFromGrid(container, item);
        if (this.isGridPositionFree(container, x, y, item.width, item.height)) {
            item.inventoryX = x;
            item.inventoryY = y;
            this.placeItemOnGrid(container, item);
            container.version++;
            return true;
        }

        item.inventoryX = originX;
        item.inventoryY = originY;
        this.placeItemOnGrid(container, item);
        container.version++;
        return false;
    }

    /** 旋转物品（宽高互换），并尝试在原位置重新放置。 */
    public static rotateItem(container: GridContainerComponent, itemUid: string): boolean {
        if (!container.allowRotate) {
            return false;
        }

        const item = container.items.get(itemUid);
        if (!item) {
            return false;
        }

        this.removeItemFromGrid(container, item);
        item.rotated = !item.rotated;
        const oldWidth = item.width;
        item.width = item.height;
        item.height = oldWidth;

        if (item.inventoryX !== undefined && item.inventoryY !== undefined) {
            if (this.isGridPositionFree(container, item.inventoryX, item.inventoryY, item.width, item.height)) {
                this.placeItemOnGrid(container, item);
                container.version++;
                return true;
            }

            item.rotated = !item.rotated;
            const rollbackWidth = item.width;
            item.width = item.height;
            item.height = rollbackWidth;
            this.placeItemOnGrid(container, item);
            container.version++;
            return false;
        }

        container.version++;
        return true;
    }

    /** 从容器中移除物品（支持减少堆叠数量）。 */
    public static removeItem(container: GridContainerComponent, itemUid: string, quantity: number = 1): boolean {
        const item = container.items.get(itemUid);
        if (!item) {
            return false;
        }

        if (item.quantity < quantity) {
            return false;
        }

        item.quantity -= quantity;
        if (item.quantity <= 0) {
            this.removeItemFromGrid(container, item);
            container.items.delete(itemUid);
        }
        container.version++;
        return true;
    }

    /** 查找容器中指定类型 id 的物品。 */
    public static findItemByTypeId(container: GridContainerComponent, typeId: string): ItemBase | undefined {
        for (const item of container.items.values()) {
            if (item.id === typeId) {
                return item;
            }
        }
        return undefined;
    }

    /** 获取所有物品数组。 */
    public static getAllItems(container: GridContainerComponent): ItemBase[] {
        return Array.from(container.items.values());
    }

    /** 按 uid 获取物品。 */
    public static getItem(container: GridContainerComponent, itemUid: string): ItemBase | undefined {
        return container.items.get(itemUid);
    }

    /** 克隆物品数据并生成新实例。 */
    public static cloneItem(item: ItemBase, overrides: Partial<ItemBase> = {}): ItemBase {
        return {
            ...item,
            uid: generateItemUid(),
            inventoryX: item.inventoryX,
            inventoryY: item.inventoryY,
            ...overrides
        };
    }

    /** 检查位置与尺寸是否可在网格中放置。 */
    public static isGridPositionFree(container: GridContainerComponent, x: number, y: number, width: number, height: number): boolean {
        if (x < 0 || y < 0 || x + width > container.gridWidth || y + height > container.gridHeight) {
            return false;
        }

        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                if (container.grid[y + dy][x + dx]) {
                    return false;
                }
            }
        }

        return true;
    }

    /** 标记网格占用。 */
    public static occupyGridSpace(container: GridContainerComponent, x: number, y: number, width: number, height: number): void {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                container.grid[y + dy][x + dx] = true;
            }
        }
    }

    /** 释放网格占用。 */
    public static freeGridSpace(container: GridContainerComponent, x: number, y: number, width: number, height: number): void {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                container.grid[y + dy][x + dx] = false;
            }
        }
    }

    /** 根据物品当前 inventoryX/inventoryY 在网格上标记占用。 */
    public static placeItemOnGrid(container: GridContainerComponent, item: ItemBase): void {
        if (item.inventoryX === undefined || item.inventoryY === undefined) {
            return;
        }
        this.occupyGridSpace(container, item.inventoryX, item.inventoryY, item.width, item.height);
    }

    /** 根据物品当前 inventoryX/inventoryY 释放占用。 */
    public static removeItemFromGrid(container: GridContainerComponent, item: ItemBase): void {
        if (item.inventoryX === undefined || item.inventoryY === undefined) {
            return;
        }
        this.freeGridSpace(container, item.inventoryX, item.inventoryY, item.width, item.height);
    }

    /** 寻找指定尺寸在容器中的首个可用位置。 */
    public static findFreeSpace(container: GridContainerComponent, width: number, height: number): { x: number; y: number } | null {
        for (let y = 0; y <= container.gridHeight - height; y++) {
            for (let x = 0; x <= container.gridWidth - width; x++) {
                if (this.isGridPositionFree(container, x, y, width, height)) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    private static canAcceptItem(container: GridContainerComponent, item: ItemBase): boolean {
        if (container.acceptedTypes.size === 0) {
            return true;
        }
        return container.acceptedTypes.has(item.type);
    }
}