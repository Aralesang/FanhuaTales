import * as ex from 'excalibur';

/**
 * AI组件 —— 存储敌人AI行为相关的数据
 * 
 * 用于NPC/敌人的自动行为控制，包含追踪玩家、攻击等行为参数。
 * 纯数据组件，具体AI逻辑由 AISystem 处理。
 */
export class AIComponent extends ex.Component {
    /** 组件类型标识 */
    public readonly type = 'ai';

    /**
     * @param speed - 移动速度（像素/秒）
     * @param chaseRadius - 追踪范围半径（像素），玩家进入该范围后敌人开始追踪
     * @param attackCooldown - 攻击冷却时间（毫秒），两次攻击之间的最短间隔
     * @param lastAttackTime - 上次攻击的时间戳（毫秒），用于计算冷却
     */
    constructor(
        public speed: number = 30,
        public chaseRadius: number = 120,
        public attackCooldown: number = 1000,
        public lastAttackTime: number = 0
    ) {
        super();
    }
}