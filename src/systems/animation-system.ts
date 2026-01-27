import * as ex from 'excalibur';
import { StateMachineComponent } from '../components/state-machine-component';
import { StateMachineEvents } from '../events/state-machine-event';
import { AnimationComponent } from '../components/animation-component';
import { DirectionComponent } from '../components/direction-component';
import { IdleState } from '../states/idle-state';
import { WalkState } from '../states/walk-state';
import { RunState } from '../states/run-state';

export class AnimationSystem extends ex.System {
    systemType = ex.SystemType.Update;
    public query!: ex.Query<
        typeof StateMachineComponent |
        typeof AnimationComponent |
        typeof DirectionComponent
    >;

    initialize(world: ex.World, scene: ex.Scene): void {
        console.log("AnimationSystem");
        
        this.query = world.query([StateMachineComponent, AnimationComponent, DirectionComponent]);
    }

    update(elapsed: number): void {
        for (const entity of this.query.entities) {
            const stateMachine = entity.get(StateMachineComponent).fsm;
            if (stateMachine == undefined) {
                continue;
            }
            // const currState = stateMachine.currentState;
            const animation = entity.get(AnimationComponent);
            // //获取方向
            let direction: ex.Vector = entity.get(DirectionComponent).direction;
            if(!direction.equals(animation.currentDirection)){
                animation.changeDirection(direction);
            }
        }
    }
}