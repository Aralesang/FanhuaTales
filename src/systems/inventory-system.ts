import * as ex from "excalibur";
import { InventoryComponent } from "../components/inventory-component";
import { ItemComponent } from "../components/item-component";
import { ItemUseRequestComponent } from "../components/item-use-request-component";
import { ItemBase } from "../item-base";
import { ItemUseSystem } from "./item-use-system";
import { GridContainerSystem } from "./grid-container-system";

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
        return GridContainerSystem.addItem(inventory, item);
    }

    /** 在两个库存之间转移物品，参数 itemId 为物品实例 uid */
    static transferItem(sourceInventory: InventoryComponent, targetInventory: InventoryComponent, itemId: string, quantity?: number): boolean {
        return GridContainerSystem.transferItem(sourceInventory, targetInventory, itemId, quantity);
    }

    /** 在指定位置放置物品 */
    static placeItem(inventory: InventoryComponent, itemId: string, x: number, y: number): boolean {
        return GridContainerSystem.placeItem(inventory, itemId, x, y);
    }

    /** 旋转物品 */
    static rotateItem(inventory: InventoryComponent, itemId: string): boolean {
        return GridContainerSystem.rotateItem(inventory, itemId);
    }

    /** 移除物品 */
    static removeItem(inventory: InventoryComponent, itemId: string, quantity: number = 1): boolean {
        return GridContainerSystem.removeItem(inventory, itemId, quantity);
    }

    /** 确认消耗物品（由系统调用） */
    static consumeItemAfterUse(inventory: InventoryComponent, itemId: string, quantity: number = 1): boolean {
        return GridContainerSystem.removeItem(inventory, itemId, quantity);
    }

    /** 在网格上放置物品 */
    public static placeItemOnGrid(inventory: InventoryComponent, item: ItemBase) {
        GridContainerSystem.placeItemOnGrid(inventory, item);
    }

    /** 从网格上移除物品 */
    public static removeItemFromGrid(inventory: InventoryComponent, item: ItemBase) {
        GridContainerSystem.removeItemFromGrid(inventory, item);
    }

    // ===== 纯数据访问方法 =====

    /** 按类型 id 查找库存中的第一个匹配物品（用于可堆叠物品合并） */
    public static findItemByTypeId(inventory: InventoryComponent, typeId: string): ItemBase | undefined {
        return GridContainerSystem.findItemByTypeId(inventory, typeId);
    }

    /** 获取物品（按实例 uid 查找） */
    public static getItem(inventory: InventoryComponent, itemId: string): ItemBase | undefined {
        return GridContainerSystem.getItem(inventory, itemId);
    }

    /** 克隆物品数据，生成新的 uid，避免库存之间共享引用 */
    public static cloneItem(item: ItemBase, overrides: Partial<ItemBase> = {}): ItemBase {
        return GridContainerSystem.cloneItem(item, overrides);
    }

    /** 获取所有物品 */
    public static getAllItems(inventory: InventoryComponent): ItemBase[] {
        return GridContainerSystem.getAllItems(inventory);
    }

    // ===== 网格操作方法 =====

    /** 检查网格位置是否可用 */
    public static isGridPositionFree(inventory: InventoryComponent, x: number, y: number, width: number, height: number): boolean {
        return GridContainerSystem.isGridPositionFree(inventory, x, y, width, height);
    }

    /** 在网格上放置物品占用 */
    public static occupyGridSpace(inventory: InventoryComponent, x: number, y: number, width: number, height: number): void {
        GridContainerSystem.occupyGridSpace(inventory, x, y, width, height);
    }

    /** 从网格上移除物品占用 */
    public static freeGridSpace(inventory: InventoryComponent, x: number, y: number, width: number, height: number): void {
        GridContainerSystem.freeGridSpace(inventory, x, y, width, height);
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