import * as ex from 'excalibur';
import { ActorState, StateMachineComponent } from '../components/state-machine-component';
import { StateMachineEvents } from '../events/state-machine-event';
import { AnimationComponent } from '../components/animation-component';
import { DirectionComponent } from '../components/direction-component';

export class AnimationSystem extends ex.System {
    systemType = ex.SystemType.Update;
    public query!: ex.Query<
        typeof StateMachineComponent |
        typeof AnimationComponent |
        typeof DirectionComponent
    >;

    initialize(world: ex.World, scene: ex.Scene): void {
        this.query = world.query([StateMachineComponent, AnimationComponent, DirectionComponent]);
        //监听状态事件
        for (const entity of this.query.entities) {
            entity.events.on(StateMachineEvents.StateChange, (event) => {
                const { newState, oldState } = event as { newState: ActorState, oldState: ActorState };
                const animation = entity.get(AnimationComponent);
                //获取方向
                let direction: ex.Vector = entity.get(DirectionComponent).direction;
                if (newState == ActorState.Idle) {
                    animation.changeAnimation(entity as ex.Actor, "idle", direction);
                }
                if (newState == ActorState.Walk) {
                    animation.changeAnimation(entity as ex.Actor, "walk", direction);
                }
                if (newState == ActorState.Run) {
                    animation.changeAnimation(entity as ex.Actor, "run", direction);
                }
            });
        }
    }

    update(elapsed: number): void {
        for (const entity of this.query.entities) {
            const currState = entity.get(StateMachineComponent).currentState;
            const animation = entity.get(AnimationComponent);
            //获取方向
            let direction: ex.Vector = entity.get(DirectionComponent).direction;
            if (currState == ActorState.Idle) {
                animation.changeAnimation(entity as ex.Actor, "idle", direction);
            }
            if (currState == ActorState.Walk) {
                animation.changeAnimation(entity as ex.Actor, "walk", direction);
            }
            if (currState == ActorState.Run) {
                animation.changeAnimation(entity as ex.Actor, "run", direction);
            }
        }
    }
}