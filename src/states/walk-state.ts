import { Actor, State } from "excalibur";
import { AnimationComponent } from "../components/animation-component";
import { DirectionComponent } from "../components/direction-component";

export const WalkState: State<Actor> = {
    name: "Walk",
    transitions: ["Idle", "Run", "Sword"],
    onEnter(context: { from: string; eventData?: any; data: Actor; }) {
        //console.log(context.data, "进入Walk状态");
        const { data } = context;
        const animationComponent = data.get(AnimationComponent);
        const direction = data.get(DirectionComponent).direction;
        animationComponent.changeAnimation(data, "walk", direction);
    },
    onUpdate(data: Actor, elapsed: number) {

    }
}