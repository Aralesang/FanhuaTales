import * as ex from 'excalibur';
import { Player } from '../entitys/player';
import { PlayerControlComponent } from '../components/player-control-component';
import { PlayerControlSystem } from '../systems/player-control-system';
import { AnimationSystem } from '../systems/animation-system';

export class TestMap extends ex.Scene {
    override onInitialize(engine: ex.Engine): void {
        //构建玩家实体
        const player = new Player();
        player.name = "player";
        player.pos = ex.vec(engine.screen.drawWidth / 2, engine.screen.drawHeight / 2);
        //玩家添加控制组件
        player.addComponent(new PlayerControlComponent());
        this.add(player);
        //实体世界
        const world = engine.currentScene.world;
        //注册系统
        world.add(new PlayerControlSystem(world, engine));
        world.add(new AnimationSystem(world));

        engine.currentScene.camera.zoom = 4;
        //engine.currentScene.camera.strategy.lockToActor(player);
    }
}