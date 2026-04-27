/** 全局自增 uid 计数器，用于为每个物品实例生成唯一标识 */
let _nextUid = 1;
/** 生成全局唯一的物品实例 ID */
export function generateItemUid(): string {
    return `item_${_nextUid++}`;
}

/** 装备槽位类型枚举 */
export enum EquipmentSlotType {
    Weapon = 'weapon',
    Armor = 'armor',
    Helmet = 'helmet',
    Boots = 'boots',
    Accessory = 'accessory'
}

/** 装备属性接口 */
export interface EquipmentStats {
    slot: EquipmentSlotType;
    attack?: number;
    defense?: number;
}

/** 物品接口 */
export interface ItemBase {
    /** 物品类型 ID（如 'iron_sword'），同类型物品共享此值 */
    id: string;
    /** 物品实例唯一 ID，用作库存 Map 的 key，区分同类型的不同实例 */
    uid: string;
    name: string;
    description: string;
    type: ItemType;
    stackable: boolean;
    maxStack: number;
    quantity: number;
    // 物品尺寸（以格子为单位）
    width: number;
    height: number;
    // 当前旋转状态（0=正常，1=旋转90度）
    rotated: boolean;
    // 在库存中的位置
    inventoryX?: number;
    inventoryY?: number;
    // 是否可使用（例如药水、卷轴等）
    usable?: boolean;
    // 使用效果（数据驱动）
    useEffect?: ItemUseEffect;
    // 装备属性
    equipmentStats?: EquipmentStats;
    // 标准价值（金币），用于交易系统
    value: number;
}

/** 物品使用效果接口 */
export interface ItemUseEffect {
    type: 'heal' | 'damage' | 'buff' | 'teleport' | 'custom';
    value?: number;
    duration?: number; // 对于buff等持续效果
    target?: 'self' | 'enemy' | 'ally'; // 目标选择
    // 可以扩展更多参数
}

/** 物品类型枚举 */
export enum ItemType {
    Consumable = 'consumable',
    Equipment = 'equipment',
    Material = 'material',
    Key = 'key'
}

/** 创建物品的工厂函数 */
export class ItemFactory {
    static createItem(id: string, name: string, description: string, type: ItemType, stackable: boolean = true, maxStack: number = 99, width: number = 1, height: number = 1, useEffect?: ItemUseEffect, value: number = 1): ItemBase {
        return {
            id,
            uid: generateItemUid(),
            name,
            description,
            type,
            stackable,
            maxStack,
            quantity: 1,
            width,
            height,
            rotated: false,
            usable: type === ItemType.Consumable,
            useEffect: useEffect,
            value
        };
    }

    static fromConfig(config: any): ItemBase {
        const type = (config.type || 'material') as ItemType;
        return {
            id: config.id,
            uid: generateItemUid(),
            name: config.name,
            description: config.description,
            type,
            stackable: config.stackable ?? true,
            maxStack: config.maxStack ?? 99,
            quantity: config.quantity ?? 1,
            width: config.width ?? 1,
            height: config.height ?? 1,
            rotated: false,
            inventoryX: config.inventoryX,
            inventoryY: config.inventoryY,
            usable: config.usable ?? (type === ItemType.Consumable),
            useEffect: config.useEffect,
            equipmentStats: config.equipment ? {
                slot: config.equipment.slot as EquipmentSlotType,
                attack: config.equipment.attack,
                defense: config.equipment.defense
            } : undefined,
            value: config.value ?? 1
        };
    }
}
