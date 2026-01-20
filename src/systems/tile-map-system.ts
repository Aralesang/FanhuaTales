import * as ex from "excalibur";

export class TileMapSystem extends ex.System {
    systemType = ex.SystemType.Draw;
    //定义这个系统感兴趣的组件
    query!: ex.Query<typeof ex.GraphicsComponent>;
    initialize(world: ex.World, scene: ex.Scene): void {
        this.query = world.query([ex.GraphicsComponent]);
        const entity = this.query.entities.find(element => element.name == "solid");
        console.log(entity);
        if(!entity){
            return;
        }
        console.log(entity);
        const graphics = entity?.get(ex.GraphicsComponent);
        if(!graphics){
            return;
        }
        graphics.opacity = 0;
    }

    update(elapsed: number): void {
        
    }
}