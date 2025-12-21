import * as ex from 'excalibur';
import { StateMachineEvents } from '../events/state-machine-event';

export enum ActorState {
    /** 闲置 */
    Idle,
    /** 走路 */
    Walk,
    /** 跑步 */
    Run
}

/** 状态机组件 */
export class StateMachineComponent extends ex.Component {
    public currentState: ActorState = ActorState.Idle;
    constructor() {
        super()
    }
    changeState(newState: ActorState, entity: ex.Entity) {
        if (newState === this.currentState) {
            return;
        }
        const oldState = this.currentState;
        this.currentState = newState;
        entity.emit(
            StateMachineEvents.StateChange,
            {
                oldState: oldState,
                newState: newState
            }
        );
    }
}