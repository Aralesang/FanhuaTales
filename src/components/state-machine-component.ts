import { Actor, Component, Entity, InitializeEvent, StateMachine, StateMachineDescription } from "excalibur";
import { IdleState } from "../states/idle-state";
import { WalkState } from "../states/walk-state";
import { RunState } from "../states/run-state";
import { SkillState } from "../states/skill-state";
import { Initial } from "../states/initial-state";

/** 玩家状态类型枚举，定义所有可能的状态名称 */
type PlayerState = "Idle" | "Walk" | "Run" | "Skill";

/**
 * 状态机组件 —— 管理实体的有限状态机 (FSM)
 * 
 * 封装了 Excalibur 的 StateMachine，在实体被添加到场景时自动初始化。
 * 状态机的状态包括：
 * - Initial：初始状态，由 StateMachineSystem 自动转换到 Idle
 * - Idle：空闲状态，实体站立不动
 * - Walk：行走状态，实体正在移动
 * - Run：奔跑状态，实体快速移动
 * - Skill：技能状态，实体正在释放技能
 * 
 * PlayerControlSystem 和 AISystem 会根据输入/AI逻辑调用 fsm.go() 切换状态。
 */
export class StateMachineComponent extends Component {
    /** Excalibur 状态机实例，在 onAdd 时初始化 */
    public fsm: StateMachine<PlayerState, Actor> | undefined;

    constructor() { 
        super();
    }

    /**
     * 当组件被添加到实体时触发，初始化状态机
     * @param owner - 拥有该组件的实体
     */
    onAdd(owner: Entity): void {
        // 定义状态机描述，包含所有状态及其转换规则
        const playerStateMachineDescription: StateMachineDescription<Actor> = {
            start: "Initial",    // 初始状态
            states: {
                Initial: Initial,  // 初始状态 → 自动转换到 Idle
                Idle: IdleState,   // 空闲状态
                Walk: WalkState,   // 行走状态
                Run: RunState,     // 奔跑状态
                Skill: SkillState  // 技能状态
            }
        } as const;
        // 以当前实体作为状态机的上下文(data)创建状态机
        this.fsm = StateMachine.create(playerStateMachineDescription, owner as Actor);
    }
}