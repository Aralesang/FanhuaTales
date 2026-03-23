import * as ex from 'excalibur';
import { ItemBase } from '../item-base';

/**
 * 物品使用请求组件 —— 存储待处理的物品使用请求数据
 * 
 * 纯数据组件，不包含任何业务逻辑。
 * 工作流程：
 * 1. InventorySystem 检测到待使用请求后，将数据写入该组件
 * 2. ItemUseSystem 轮询该组件，发现未处理的请求后执行对应效果
 * 3. 处理完成后设置 clearFlag，由系统在下一帧清除数据
 */
export class ItemUseRequestComponent extends ex.Component {
    /** 组件类型标识 */
    public readonly type = 'itemUseRequest';

    /** 待使用的物品数据，null 表示无请求 */
    public itemToUse: ItemBase | null = null;

    /** 使用者实体引用 */
    public user: ex.Entity | null = null;

    /** 目标实体引用（可选，例如对敌人使用物品） */
    public target: ex.Entity | null = null;

    /** 请求发起时间戳（Date.now() 毫秒） */
    public requestTime: number = 0;

    /** 是否已被 ItemUseSystem 处理 */
    public processed: boolean = false;

    /** 处理结果，true 表示使用成功 */
    public success: boolean = false;

    /** 清除标记 —— ItemUseSystem 处理完成后置为 true，下一帧统一清除数据 */
    public clearFlag: boolean = false;
}