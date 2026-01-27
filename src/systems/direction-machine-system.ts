import * as ex from "excalibur";
import { StateMachineComponent } from "../components/state-machine-component";
import { DirectionComponent } from "../components/direction-component";
export class DirectionSystem extends ex.System {
    systemType: ex.SystemType = ex.SystemType.Update;
    public query!: ex.Query<
            typeof DirectionComponent
        >;
    initialize(world: ex.World, scene: ex.Scene): void {
        console.log("DirectionSystem");
        this.query = world.query([DirectionComponent]);
    }
    update(elapsed: number): void {
        // for (const entity of this.query.entities) {
        //     const directionComp = entity.get(DirectionComponent);
        // }
    }
    
}