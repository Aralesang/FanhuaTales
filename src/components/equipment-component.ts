import { Component } from 'excalibur';
import { GridContainerComponent } from './grid-container-component';
import { ItemBase, ItemType, EquipmentSlotType } from '../item-base';

/**
 * 装备组件 —— 管理角色的所有装备槽
 *
 * 包含5个装备槽：武器、头盔、护甲、靴子、饰品。
 * 每个装备槽是一个独立的 1x1 GridContainerComponent，
 * 可以直接复用现有的 InventoryPane 和拖拽系统。
 *
 * 组件本身不承载业务逻辑，仅提供装备数据的组织与查询便利方法。
 */
export class EquipmentComponent extends Component {
    /** 组件类型标识 */
    public readonly type = 'equipment';

    /** 武器槽 */
    public readonly weaponSlot: GridContainerComponent;
    /** 头盔槽 */
    public readonly helmetSlot: GridContainerComponent;
    /** 护甲槽 */
    public readonly armorSlot: GridContainerComponent;
    /** 靴子槽 */
    public readonly bootsSlot: GridContainerComponent;
    /** 饰品槽 */
    public readonly accessorySlot: GridContainerComponent;

    constructor() {
        super();
        this.weaponSlot = new GridContainerComponent({
            kind: 'equipment',
            gridWidth: 1,
            gridHeight: 1,
            acceptedTypes: [ItemType.Equipment],
            slotType: EquipmentSlotType.Weapon
        });
        this.helmetSlot = new GridContainerComponent({
            kind: 'equipment',
            gridWidth: 1,
            gridHeight: 1,
            acceptedTypes: [ItemType.Equipment],
            slotType: EquipmentSlotType.Helmet
        });
        this.armorSlot = new GridContainerComponent({
            kind: 'equipment',
            gridWidth: 1,
            gridHeight: 1,
            acceptedTypes: [ItemType.Equipment],
            slotType: EquipmentSlotType.Armor
        });
        this.bootsSlot = new GridContainerComponent({
            kind: 'equipment',
            gridWidth: 1,
            gridHeight: 1,
            acceptedTypes: [ItemType.Equipment],
            slotType: EquipmentSlotType.Boots
        });
        this.accessorySlot = new GridContainerComponent({
            kind: 'equipment',
            gridWidth: 1,
            gridHeight: 1,
            acceptedTypes: [ItemType.Equipment],
            slotType: EquipmentSlotType.Accessory
        });
    }

    /**
     * 根据装备槽类型获取对应的容器。
     * @param slotType - 装备槽类型
     * @returns 对应的 GridContainerComponent
     */
    public getSlot(slotType: EquipmentSlotType): GridContainerComponent {
        switch (slotType) {
            case EquipmentSlotType.Weapon: return this.weaponSlot;
            case EquipmentSlotType.Helmet: return this.helmetSlot;
            case EquipmentSlotType.Armor: return this.armorSlot;
            case EquipmentSlotType.Boots: return this.bootsSlot;
            case EquipmentSlotType.Accessory: return this.accessorySlot;
        }
    }

    /**
     * 获取指定装备槽中当前装备的物品。
     * @param slotType - 装备槽类型
     * @returns 装备的物品，若槽位为空则返回 null
     */
    public getEquippedItem(slotType: EquipmentSlotType): ItemBase | null {
        const slot = this.getSlot(slotType);
        const items = Array.from(slot.items.values());
        return items.length > 0 ? items[0] : null;
    }

    /**
     * 计算所有已装备物品的攻击力总和。
     * @returns 总攻击力加成
     */
    public getTotalAttack(): number {
        let total = 0;
        for (const slotType of Object.values(EquipmentSlotType)) {
            const item = this.getEquippedItem(slotType as EquipmentSlotType);
            if (item?.equipmentStats?.attack) {
                total += item.equipmentStats.attack;
            }
        }
        return total;
    }

    /**
     * 计算所有已装备物品的防御力总和。
     * @returns 总防御力加成
     */
    public getTotalDefense(): number {
        let total = 0;
        for (const slotType of Object.values(EquipmentSlotType)) {
            const item = this.getEquippedItem(slotType as EquipmentSlotType);
            if (item?.equipmentStats?.defense) {
                total += item.equipmentStats.defense;
            }
        }
        return total;
    }
}
