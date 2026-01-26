import * as ex from "excalibur";
import { StateMachineComponent } from "../components/state-machine-component";
export class StateMachineSystem extends ex.System {
    systemType: ex.SystemType = ex.SystemType.Update;
    public query!: ex.Query<
            typeof StateMachineComponent
        >;
    initialize(world: ex.World, scene: ex.Scene): void {
        console.log("StateMachineSystem");
        this.query = world.query([StateMachineComponent]);
    }
    update(elapsed: number): void {
        for (const entity of this.query.entities) {
            const stateMachine = entity.get(StateMachineComponent).fsm;
            if (stateMachine == undefined) {
                continue;
            }
            stateMachine.update(elapsed);
        }
    }
    
}