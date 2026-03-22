/** 物品接口 */
export interface ItemBase {
    id: string;
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
    // 可以添加更多属性，如图标、价值等
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
    static createItem(id: string, name: string, description: string, type: ItemType, stackable: boolean = true, maxStack: number = 99, width: number = 1, height: number = 1, useEffect?: ItemUseEffect): ItemBase {
        return {
            id,
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
            useEffect: useEffect
        };
    }

    static fromConfig(config: any): ItemBase {
        const type = (config.type || 'material') as ItemType;
        return {
            id: config.id,
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
            useEffect: config.useEffect
        };
    }
}