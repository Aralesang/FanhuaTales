import * as ex from "excalibur";
import { InventoryComponent } from "../components/inventory-component";
import { ItemComponent } from "../components/item-component";
import { ItemUseRequestComponent } from "../components/item-use-request-component";
import { ItemBase } from "../item-base";
import { ItemUseSystem } from "./item-use-system";

/** 库存系统 */
export class InventorySystem extends ex.System {
    systemType: ex.SystemType = ex.SystemType.Update;
    public query!: ex.Query<typeof InventoryComponent>;

    initialize(world: ex.World, scene: ex.Scene): void {
        console.log("InventorySystem initialized");
        this.query = world.query([InventoryComponent]);
    }

    update(elapsed: number): void {
        // 处理所有库存组件的待使用请求（数据驱动）
        for (const entity of this.query.entities) {
            const inventory = entity.get(InventoryComponent);
            if (inventory && inventory.pendingUseRequests.length > 0) {
                this.processUseRequests(entity, inventory);
            }
        }
    }

    /** 处理道具使用请求 */
    private processUseRequests(entity: ex.Entity, inventory: InventoryComponent): void {
        // 从后往前处理，避免索引问题
        for (let i = inventory.pendingUseRequests.length - 1; i >= 0; i--) {
            const request = inventory.pendingUseRequests[i];
            const item = InventorySystem.getItem(inventory, request.itemId);

            if (!item) {
                console.warn(`尝试使用不存在的物品：${request.itemId}`);
                InventorySystem.removeUseRequest(inventory, i);
                continue;
            }

            if (!item.usable) {
                console.log(`${item.name} 不能使用`);
                InventorySystem.removeUseRequest(inventory, i);
                continue;
            }

            // 设置ItemUseRequestComponent状态（完全数据驱动）
            let requestComponent = entity.get(ItemUseRequestComponent);
            if (!requestComponent) {
                requestComponent = new ItemUseRequestComponent();
                entity.addComponent(requestComponent);
            }

            // 如果已有待处理请求（直接检查数据标记），跳过
            if (requestComponent.itemToUse !== null && !requestComponent.processed) {
                console.log(`已有待处理的物品使用请求，跳过: ${item.name}`);
                continue;
            }

            // 直接设置数据字段，由 ItemUseSystem 轮询处理
            requestComponent.itemToUse = item;
            requestComponent.user = entity;
            requestComponent.target = request.target || null;
            requestComponent.requestTime = Date.now();
            requestComponent.processed = false;
            requestComponent.success = false;
            requestComponent.clearFlag = false;
            console.log(`设置物品使用请求状态: ${item.name}`);

            // 移除待处理请求（已转换为ItemUseRequestComponent状态）
            InventorySystem.removeUseRequest(inventory, i);
        }
    }

    /** 处理物品拾取 */
    static handleItemPickup(player: ex.Entity, itemEntity: ex.Entity): void {
        const inventory = player.get(InventoryComponent);
        const itemComp = itemEntity.get(ItemComponent);
        if (inventory && itemComp) {
            if (InventorySystem.addItem(inventory, itemComp.item)) {
                // 成功添加，移除物品实体
                itemEntity.kill();
                console.log(`Picked up ${itemComp.item.name}`);
            } else {
                console.log("Inventory full or cannot stack more");
            }
        }
    }

    /** 添加物品到库存（自动寻找合适位置） */
    static addItem(inventory: InventoryComponent, item: ItemBase): boolean {
        if (inventory.items.has(item.id) && item.stackable) {
            const existing = inventory.items.get(item.id)!;
            if (existing.quantity + item.quantity <= existing.maxStack) {
                existing.quantity += item.quantity;
                return true;
            } else {
                return false; // 无法堆叠更多
            }
        } else {
            // 尝试找到合适的位置放置物品
            const position = InventorySystem.findFreeSpace(inventory, item);
            if (position) {
                const newItem = { ...item, inventoryX: position.x, inventoryY: position.y };
                InventorySystem.placeItemOnGrid(inventory, newItem);
                inventory.items.set(item.id, newItem);
                return true;
            }
            return false; // 没有足够空间
        }
    }

    /** 在两个库存之间转移物品 */
    static transferItem(sourceInventory: InventoryComponent, targetInventory: InventoryComponent, itemId: string, quantity?: number): boolean {
        const item = sourceInventory.items.get(itemId);
        if (!item) {
            return false;
        }

        const transferQuantity = Math.min(quantity ?? item.quantity, item.quantity);
        const movedItem = InventorySystem.cloneItem(item, {
            quantity: transferQuantity,
            inventoryX: undefined,
            inventoryY: undefined
        });

        if (!InventorySystem.addItem(targetInventory, movedItem)) {
            return false;
        }

        return InventorySystem.removeItem(sourceInventory, itemId, transferQuantity);
    }

    /** 在指定位置放置物品 */
    static placeItem(inventory: InventoryComponent, itemId: string, x: number, y: number): boolean {
        const item = inventory.items.get(itemId);
        if (!item) return false;

        // 先移除旧位置
        InventorySystem.removeItemFromGrid(inventory, item);

        // 检查新位置是否可用
        if (InventorySystem.isGridPositionFree(inventory, x, y, item.width, item.height)) {
            item.inventoryX = x;
            item.inventoryY = y;
            InventorySystem.placeItemOnGrid(inventory, item);
            return true;
        }

        // 如果新位置不可用，放回原位置
        if (item.inventoryX !== undefined && item.inventoryY !== undefined) {
            InventorySystem.placeItemOnGrid(inventory, item);
        }

        return false;
    }

    /** 旋转物品 */
    static rotateItem(inventory: InventoryComponent, itemId: string): boolean {
        const item = inventory.items.get(itemId);
        if (!item) return false;

        // 移除当前占用
        InventorySystem.removeItemFromGrid(inventory, item);

        // 旋转物品
        item.rotated = !item.rotated;
        const temp = item.width;
        item.width = item.height;
        item.height = temp;

        // 尝试在新尺寸下重新放置
        if (item.inventoryX !== undefined && item.inventoryY !== undefined) {
            if (InventorySystem.isGridPositionFree(inventory, item.inventoryX, item.inventoryY, item.width, item.height)) {
                InventorySystem.placeItemOnGrid(inventory, item);
                return true;
            } else {
                // 旋转后无法放置，撤销旋转
                item.rotated = !item.rotated;
                const temp2 = item.width;
                item.width = item.height;
                item.height = temp2;
                InventorySystem.placeItemOnGrid(inventory, item);
                return false;
            }
        }

        return true;
    }

    /** 移除物品 */
    static removeItem(inventory: InventoryComponent, itemId: string, quantity: number = 1): boolean {
        if (inventory.items.has(itemId)) {
            const item = inventory.items.get(itemId)!;
            if (item.quantity >= quantity) {
                item.quantity -= quantity;
                if (item.quantity <= 0) {
                    InventorySystem.removeItemFromGrid(inventory, item);
                    inventory.items.delete(itemId);
                }
                return true;
            }
        }
        return false;
    }

    /** 确认消耗物品（由系统调用） */
    static consumeItemAfterUse(inventory: InventoryComponent, itemId: string, quantity: number = 1): boolean {
        if (inventory.items.has(itemId)) {
            const item = inventory.items.get(itemId)!;
            if (item.quantity >= quantity) {
                item.quantity -= quantity;
                if (item.quantity <= 0) {
                    InventorySystem.removeItemFromGrid(inventory, item);
                    inventory.items.delete(itemId);
                }
                return true;
            }
        }
        return false;
    }

    /** 寻找物品的空闲位置 */
    private static findFreeSpace(inventory: InventoryComponent, item: ItemBase): { x: number, y: number } | null {
        for (let y = 0; y <= inventory.GRID_HEIGHT - item.height; y++) {
            for (let x = 0; x <= inventory.GRID_WIDTH - item.width; x++) {
                if (InventorySystem.isGridPositionFree(inventory, x, y, item.width, item.height)) {
                    return { x, y };
                }
            }
        }
        return null;
    }

    /** 在网格上放置物品 */
    public static placeItemOnGrid(inventory: InventoryComponent, item: ItemBase) {
        if (item.inventoryX === undefined || item.inventoryY === undefined) return;
        InventorySystem.occupyGridSpace(inventory, item.inventoryX, item.inventoryY, item.width, item.height);
    }

    /** 从网格上移除物品 */
    public static removeItemFromGrid(inventory: InventoryComponent, item: ItemBase) {
        if (item.inventoryX === undefined || item.inventoryY === undefined) return;
        InventorySystem.freeGridSpace(inventory, item.inventoryX, item.inventoryY, item.width, item.height);
    }

    // ===== 纯数据访问方法 =====

    /** 获取物品 */
    public static getItem(inventory: InventoryComponent, itemId: string): ItemBase | undefined {
        return inventory.items.get(itemId);
    }

    /** 克隆物品数据，避免库存之间共享引用 */
    public static cloneItem(item: ItemBase, overrides: Partial<ItemBase> = {}): ItemBase {
        return {
            ...item,
            inventoryX: item.inventoryX,
            inventoryY: item.inventoryY,
            ...overrides
        };
    }

    /** 获取所有物品 */
    public static getAllItems(inventory: InventoryComponent): ItemBase[] {
        const items: ItemBase[] = [];
        for (const item of inventory.items.values()) {
            items.push(item);
        }
        return items;
    }

    // ===== 网格操作方法 =====

    /** 检查网格位置是否可用 */
    public static isGridPositionFree(inventory: InventoryComponent, x: number, y: number, width: number, height: number): boolean {
        if (x < 0 || y < 0 || x + width > inventory.GRID_WIDTH || y + height > inventory.GRID_HEIGHT) {
            return false;
        }

        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                if (inventory.grid[y + dy][x + dx]) {
                    return false;
                }
            }
        }
        return true;
    }

    /** 在网格上放置物品占用 */
    public static occupyGridSpace(inventory: InventoryComponent, x: number, y: number, width: number, height: number): void {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                inventory.grid[y + dy][x + dx] = true;
            }
        }
    }

    /** 从网格上移除物品占用 */
    public static freeGridSpace(inventory: InventoryComponent, x: number, y: number, width: number, height: number): void {
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                inventory.grid[y + dy][x + dx] = false;
            }
        }
    }

    // ===== 使用请求管理方法 =====

    /** 添加道具使用请求 */
    public static addUseRequest(inventory: InventoryComponent, itemId: string, target?: ex.Entity): void {
        inventory.pendingUseRequests.push({
            itemId,
            target,
            timestamp: Date.now()
        });
    }

    /** 移除已处理的道具使用请求 */
    public static removeUseRequest(inventory: InventoryComponent, index: number): void {
        if (index >= 0 && index < inventory.pendingUseRequests.length) {
            inventory.pendingUseRequests.splice(index, 1);
        }
    }

    /** 清空所有待处理的道具使用请求 */
    public static clearUseRequests(inventory: InventoryComponent): void {
        inventory.pendingUseRequests = [];
    }
}