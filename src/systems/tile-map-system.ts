import * as ex from "excalibur";

export class TileMapSystem extends ex.System {
    systemType = ex.SystemType.Draw;
    //定义这个系统感兴趣的组件
    
    initialize(world: ex.World, scene: ex.Scene): void {
        const entity = world.entities.find(element => element.name == "solid");
        console.log(entity);
        
    }

    update(elapsed: number): void {
        
    }
}