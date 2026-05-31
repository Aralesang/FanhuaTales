import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import {
    InputComponent,
    InventoryComponent,
    ItemDefinition
} from '../ecs/Component';

/**
 * 库存系统
 *
 * 职责：
 * - 检测 B 键输入并打印库存内容到控制台
 * - 提供 addItem / removeItem 工具方法供其他系统调用
 */
export class InventorySystem extends System {
    private previousBDown: WeakMap<Entity, boolean> = new WeakMap();

    update(entities: Entity[], _delta: number): void {
        for (const entity of entities) {
            if (!entity.hasComponent('inventory') || !entity.hasComponent('input')) {
                continue;
            }

            const input = entity.getComponent<InputComponent>('input')!;
            const prevDown = this.previousBDown.get(entity) ?? false;
            const isDown = input.inventoryKey.isDown;

            // B 键上升沿：打印库存
            if (isDown && !prevDown) {
                this.printInventory(entity);
            }

            this.previousBDown.set(entity, isDown);
        }
    }

    /**
     * 在控制台打印实体的库存内容
     */
    private printInventory(entity: Entity): void {
        const inventory = entity.getComponent<InventoryComponent>('inventory')!;
        const itemsMap = this.scene.cache.json.get('items') as
            Record<string, ItemDefinition> | undefined;

        const entityName = entity.hasComponent('player') ? '玩家' : '实体';
        console.log(`=== ${entityName} 库存 ===`);

        let hasItems = false;
        for (let i = 0; i < inventory.capacity; i++) {
            const item = inventory.items[i];
            if (item) {
                hasItems = true;
                const def = itemsMap?.[item.itemId];
                const name = def?.name ?? item.itemId;
                const typeLabel = def ? `[${this.typeLabel(def.type)}]` : '';
                console.log(`  [${i}] ${name} x${item.quantity} ${typeLabel}`);
            }
        }

        if (!hasItems) {
            console.log('  (空)');
        }

        console.log('================');
    }

    private typeLabel(type: string): string {
        switch (type) {
            case 'consumable': return '消耗品';
            case 'equipment': return '装备';
            case 'material': return '材料';
            default: return type;
        }
    }

    /**
     * 向库存中添加道具
     *
     * @param inventory   目标库存组件
     * @param itemsMap    道具定义表（用于读取 stackable / maxStack）
     * @param itemId      道具 ID
     * @param quantity    数量（默认 1）
     * @returns           是否全部添加成功
     */
    static addItem(
        inventory: InventoryComponent,
        itemsMap: Record<string, ItemDefinition>,
        itemId: string,
        quantity: number = 1
    ): boolean {
        const def = itemsMap[itemId];
        if (!def) {
            console.warn(`[InventorySystem] 未知道具 ID: ${itemId}`);
            return false;
        }

        if (quantity <= 0) return false;

        let remaining = quantity;

        // 可堆叠：先尝试合并到已有格子
        if (def.stackable) {
            for (let i = 0; i < inventory.capacity && remaining > 0; i++) {
                const item = inventory.items[i];
                if (item && item.itemId === itemId) {
                    const space = def.maxStack - item.quantity;
                    if (space > 0) {
                        const add = Math.min(remaining, space);
                        item.quantity += add;
                        remaining -= add;
                    }
                }
            }
        }

        // 还有剩余，找空格子放入
        for (let i = 0; i < inventory.capacity && remaining > 0; i++) {
            if (inventory.items[i] === null) {
                const add = def.stackable
                    ? Math.min(remaining, def.maxStack)
                    : 1;
                inventory.items[i] = { itemId, quantity: add };
                remaining -= add;
            }
        }

        if (remaining > 0) {
            console.warn(`[InventorySystem] 库存已满，${itemId} 有 ${remaining} 个未能放入`);
            return false;
        }

        return true;
    }

    /**
     * 从库存中移除道具
     *
     * @param inventory   目标库存组件
     * @param slotIndex   格子索引
     * @param quantity    数量（默认全部）
     * @returns           是否成功移除
     */
    static removeItem(
        inventory: InventoryComponent,
        slotIndex: number,
        quantity?: number
    ): boolean {
        if (slotIndex < 0 || slotIndex >= inventory.capacity) return false;

        const item = inventory.items[slotIndex];
        if (!item) return false;

        const removeQty = quantity ?? item.quantity;

        if (removeQty >= item.quantity) {
            inventory.items[slotIndex] = null;
        } else {
            item.quantity -= removeQty;
        }

        return true;
    }

    /**
     * 按道具 ID 从库存中查找第一个匹配的格子索引
     *
     * @returns 格子索引，未找到返回 -1
     */
    static findItemSlot(
        inventory: InventoryComponent,
        itemId: string
    ): number {
        for (let i = 0; i < inventory.capacity; i++) {
            const item = inventory.items[i];
            if (item && item.itemId === itemId) {
                return i;
            }
        }
        return -1;
    }
}
