import { Actor, State } from "excalibur";

export const WalkState: State<Actor> = {
    name: "Walk",
    transitions: ["Idle", "Run", "Sword"],
    onEnter: (context: { from: string; eventData?: any; data: Actor; }) => {
        console.log(context.data, "进入Walk状态");
    },
}