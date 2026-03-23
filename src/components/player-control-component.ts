// components/player-control-component.ts
import * as ex from 'excalibur';

/**
 * 玩家控制组件 —— 标识实体可被玩家键盘控制
 * 
 * 包含移动速度参数。只有挂载了该组件的实体才会被 PlayerControlSystem 处理。
 * 通常只挂载在当前操控的玩家角色上。
 */
export class PlayerControlComponent extends ex.Component {
    /** 组件类型标识 */
    public readonly type = 'player-control';

    /**
     * @param speed - 移动速度（像素/秒），控制角色行走速度
     */
    constructor(public speed: number = 25) {
        super();
    }
}