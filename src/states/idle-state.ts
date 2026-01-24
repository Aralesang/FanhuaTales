import { Actor, Entity, State } from "excalibur";

export class IdleState implements State<Actor> {
    name = "Idle";
    transitions: string[] = ["Walk", "Run"];
    onEnter(context: { from: string; eventData?: any; data: Actor; }) {
        console.log(context.data, "进入Idle状态");
    };
    onState() {

    }
    onExit?: ((context: { to: string; data: Actor; }) => boolean | void) | undefined;
    onUpdate?: ((data: Actor, elapsed: number) => any) | undefined;

}