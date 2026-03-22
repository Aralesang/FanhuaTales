import { Actor, Entity, State } from "excalibur";
import { AnimationComponent } from "../components/animation-component";

export const RunState: State<Actor> = {
    name: "Run",
    transitions: ["Idle", "Walk", "Skill"],
    onEnter(context: { from: string; eventData?: any; data: Actor; }) {
        //console.log(context.data, "进入Run状态");
        const { data } = context;
        const animationComponent = data.get(AnimationComponent);
        animationComponent.animType = "run";
    }
}