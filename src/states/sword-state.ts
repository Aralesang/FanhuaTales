import { Actor, Entity, State } from "excalibur";
import { AnimationComponent } from "../components/animation-component";
import { StateMachineComponent } from "../components/state-machine-component";

export const SwordState: State<Actor> = {
    name: "Sword",
    transitions: ["Idle"],
    onEnter: (context: { from: string; eventData?: any; data: Actor; }) => {
        console.log(context.data, "进入Sword状态");
    },
    onUpdate: (data: Actor, elapsed: number) => {
        const animationComponent = data.get(AnimationComponent);
        const currentAnimation = animationComponent.getCurrentAnimation();
        if (currentAnimation == undefined) {
            return;
        }
        //console.log(currentAnimation.currentFrameIndex, currentAnimation.frames.length);
        if (currentAnimation.currentFrameIndex == currentAnimation.frames.length - 1) {
            {
                //动画播放完毕，切换回Idle状态
                const stateMachine = data.get(StateMachineComponent).fsm;
                if(stateMachine == undefined){
                    return;
                }
                currentAnimation.reset();
                stateMachine.go("Idle");
            }

        }
    }

}