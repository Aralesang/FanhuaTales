import { Actor, Component, StateMachine, StateMachineDescription } from "excalibur";
import { IdleState } from "../states/idle-state";
import { WalkState } from "../states/walk-state";

/** 状态机组件 */
export class StateMachineComponent extends Component {
    public fsm: StateMachine<"Idle" | "Walk", Actor>;
    constructor() { 
        super();
        const playerStateMachineDescription: StateMachineDescription<Actor> = {
            start: "Idle",
            states: {
                Idle: new IdleState(),
                Walk: new WalkState()
            }
        };
        //创建有限状态机
        this.fsm = StateMachine.create(playerStateMachineDescription, this.owner as Actor);
    }
}