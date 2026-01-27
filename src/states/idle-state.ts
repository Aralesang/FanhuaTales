import { Actor, Entity, State } from "excalibur";
import { AnimationComponent } from "../components/animation-component";
import { DirectionComponent } from "../components/direction-component";

export const IdleState: State<Actor> = {
    name: "Idle",
    transitions: ["Walk", "Run", "Sword"],
    onEnter(context: { from: string; eventData?: any; data: Actor; }) {
        console.log(context.data, "进入Idle状态");
        const {data} = context;
        const animationComponent = data.get(AnimationComponent);
        const direction = data.get(DirectionComponent).direction;
        animationComponent.changeAnimation(data, "idle", direction);
    },
    onUpdate(data: Actor, elapsed: number) {
        
    }
}