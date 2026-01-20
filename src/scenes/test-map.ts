import * as ex from 'excalibur';
import { Player } from '../entitys/player';
import { PlayerControlComponent } from '../components/player-control-component';
import { PlayerControlSystem } from '../systems/player-control-system';
import { AnimationSystem } from '../systems/animation-system';

export class TestMap extends ex.Scene {
    override onInitialize(engine: ex.Engine): void {
        //实体世界
        const world = engine.currentScene.world;
        //注册系统
        world.add(new PlayerControlSystem(engine));
        world.add(new AnimationSystem());
    }
}