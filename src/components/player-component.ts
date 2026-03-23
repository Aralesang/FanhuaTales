import * as ex from 'excalibur';

/**
 * 玩家标识组件 —— 标识一个实体为玩家角色
 * 
 * 纯标记组件，不包含数据。用于 ECS 查询时筛选玩家实体，
 * 例如 PickupSystem 根据该组件查询玩家实体来检测物品拾取。
 */
export class PlayerComponent extends ex.Component {
    /** 组件类型标识 */
    public readonly type = 'player';
}