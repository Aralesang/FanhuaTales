import * as ex from 'excalibur';
import { ItemBase } from '../item-base';

/** 物品使用请求组件 */
export class ItemUseRequestComponent extends ex.Component {
    public readonly type = 'itemUseRequest';

    /** 待使用的物品 */
    public itemToUse: ItemBase | null = null;

    /** 使用者实体 */
    public user: ex.Entity | null = null;

    /** 目标实体（可选） */
    public target: ex.Entity | null = null;

    /** 请求时间戳 */
    public requestTime: number = 0;

    /** 是否已处理 */
    public processed: boolean = false;

    /** 处理结果 */
    public success: boolean = false;

    /** 构造函数 */
    constructor() {
        super();
    }

    /** 设置使用请求 */
    setRequest(item: ItemBase, user: ex.Entity, target?: ex.Entity): void {
        this.itemToUse = item;
        this.user = user;
        this.target = target || null;
        this.requestTime = Date.now();
        this.processed = false;
        this.success = false;
    }

    /** 清除请求 */
    clearRequest(): void {
        this.itemToUse = null;
        this.user = null;
        this.target = null;
        this.requestTime = 0;
        this.processed = false;
        this.success = false;
    }

    /** 检查是否有待处理的请求 */
    hasPendingRequest(): boolean {
        return this.itemToUse !== null && !this.processed;
    }
}