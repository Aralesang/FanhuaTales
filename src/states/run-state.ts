import { Actor, Entity, State } from "excalibur";

export const RunState: State<Actor> = {
    name: "Run",
    transitions: ["Idle", "Walk", "Sword"],
    onEnter: (context: { from: string; eventData?: any; data: Actor; }) => {
        console.log(context.data, "进入Run状态");
    }
}