import { Actor, Component, Entity, InitializeEvent, StateMachine, StateMachineDescription } from "excalibur";
import { IdleState } from "../states/idle-state";
import { WalkState } from "../states/walk-state";
import { RunState } from "../states/run-state";
import { SkillState } from "../states/skill-state";
import { Initial } from "../states/initial-state";

/** 状态枚举 */
type PlayerState = "Idle" | "Walk" | "Run" | "Skill";

/** 状态机组件 */
export class StateMachineComponent extends Component {
    public fsm: StateMachine<PlayerState, Actor> | undefined;
    constructor() { 
        super();
        
    }

    onAdd(owner: Entity): void {
        const playerStateMachineDescription: StateMachineDescription<Actor> = {
            start: "Initial",
            states: {
                Initial: Initial,
                Idle: IdleState,
                Walk: WalkState,
                Run: RunState,
                Skill: SkillState
            }
        } as const;
        this.fsm = StateMachine.create(playerStateMachineDescription, owner as Actor);
    }
}