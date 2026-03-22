import { Actor, State } from "excalibur";
import { AnimationComponent } from "../components/animation-component";
import { DirectionComponent } from "../components/direction-component";

export const WalkState: State<Actor> = {
    name: "Walk",
    transitions: ["Idle", "Run", "Skill"],
    onEnter(context: { from: string; eventData?: any; data: Actor; }) {
        //console.log(context.data, "进入Walk状态");
        const { data } = context;
        const animationComponent = data.get(AnimationComponent);
        animationComponent.animType = "walk";
    },
    onUpdate(data: Actor, elapsed: number) {

    }
}