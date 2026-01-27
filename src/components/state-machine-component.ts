import { Actor, Component, Entity, InitializeEvent, StateMachine, StateMachineDescription } from "excalibur";
import { IdleState } from "../states/idle-state";
import { WalkState } from "../states/walk-state";
import { RunState } from "../states/run-state";
import { SwordState } from "../states/sword-state";
import { Initial } from "../states/initial-state";

/** 状态枚举 */
type PlayerState = "Idle" | "Walk" | "Run" | "Sword";

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
                Sword: SwordState
            }
        } as const;
        this.fsm = StateMachine.create(playerStateMachineDescription, owner as Actor);
    }
}