import { Actor } from "excalibur";

/**
 * 技能接口
 * 定义技能的基本结构和行为，所有技能类都应实现此接口
 */
export interface Skill {
    /** 技能名称，用于标识和查找技能 */
    name: string;
    /** 冷却时间（毫秒），技能使用后需要等待的时间 */
    cooldown: number;
    /** 当前冷却剩余时间，0表示技能可用 */
    currentCooldown: number;
    /** 动画类型，对应动画组件的动画名称 */
    animationType: string;
    /** 音效名称，可选，用于播放技能音效 */
    soundName?: string;

    /**
     * 执行技能
     * @param actor 执行技能的角色实体
     * @returns Promise<void> 异步执行，完成后resolve
     */
    execute(actor: Actor): Promise<void>;
}