import { Actor, Entity, State } from "excalibur";

export const Initial: State<Actor> = {
    name: "Initial",
    transitions: ["Idle"],
}