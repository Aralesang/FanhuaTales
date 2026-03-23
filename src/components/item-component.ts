import * as ex from 'excalibur';
import { ItemBase } from '../item-base';

/**
 * 物品组件 —— 标识一个实体为可拾取的物品
 * 
 * 挂载在场景中的物品Actor上，存储物品的基本信息。
 * PickupSystem 会检测带有该组件的实体，并在玩家靠近时触发拾取。
 */
export class ItemComponent extends ex.Component {
    /** 组件类型标识 */
    public readonly type = 'item';
    /** 物品数据 */
    public item: ItemBase;

    /**
     * @param item - 物品基本信息数据
     */
    constructor(item: ItemBase) {
        super();
        this.item = item;
    }
}