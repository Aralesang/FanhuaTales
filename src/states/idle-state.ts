import { Actor, Entity, State } from "excalibur";

export const IdleState: State<Actor> = {
    name: "Idle",
    transitions: ["Walk", "Run", "Sword"],
    onEnter: (context: { from: string; eventData?: any; data: Actor; }) => {
        console.log(context.data, "进入Idle状态");
    }
}