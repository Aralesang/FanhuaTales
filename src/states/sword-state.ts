import { Actor, Entity, State } from "excalibur";
import { AnimationComponent } from "../components/animation-component";
import { StateMachineComponent } from "../components/state-machine-component";
import { DirectionComponent } from "../components/direction-component";

export const SwordState: State<Actor> = {
    name: "Sword",
    transitions: ["Idle"],
    onEnter(context: { from: string; eventData?: any; data: Actor; }) {
        const {data} = context;
        console.log(context.data, "进入Sword状态");
        const animationComponent = data.get(AnimationComponent);
        const direction = data.get(DirectionComponent).direction;
        const stateMachine = data.get(StateMachineComponent).fsm;
        animationComponent.changeAnimation(data, "sword", direction);
        const animation = animationComponent.getCurrentAnimation();
        animation?.events.once('end', ()=>{
            console.log("攻击结束");
            stateMachine?.go("Idle");
        });
    }
}