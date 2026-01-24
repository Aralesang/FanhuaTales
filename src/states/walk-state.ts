import { Actor, Entity, State } from "excalibur";

export class WalkState implements State<Actor> {
    name = "Walk";
    transitions: string[] = ["Idle", "Run"];
    onEnter(context: { from: string; eventData?: any; data: Actor; }) {
        console.log(context.data, "进入Walk状态");
    };
    onState() {

    }
    onExit?: ((context: { to: string; data: Actor; }) => boolean | void) | undefined;
    onUpdate?: ((data: Actor, elapsed: number) => any) | undefined;

}