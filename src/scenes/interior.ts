import * as ex from 'excalibur';
import { Player } from '../entitys/player';
import { PlayerControlComponent } from '../components/player-control-component';
import { PlayerControlSystem } from '../systems/player-control-system';
import { AnimationSystem } from '../systems/animation-system';
import { Asset } from '../asset';
import { FactoryProps } from '@excaliburjs/plugin-tiled';
import BaseScene from '../base-scene';
import { PlayerComponent } from '../components/player-component';

export class Interior extends BaseScene {
    constructor() {
        super("interior");
    }
    override onInitialize(engine: ex.Engine): void {
        super.onInitialize(engine);
        //获取门
        const doors = Asset.tileMapMap[this.sceneName].getObjectsByClassName("Door");
        for (const door of doors) {
            // 获取Tiled 中定义的自定义属性
            const targetScene = door.properties.get('target_scene') as string;
            console.log(door.properties);
            //创建触发器
            const doorTrigger = new ex.Trigger({
                pos: ex.vec(door.x + (door.tiledObject.width || 0) / 2, door.y + (door.tiledObject.height || 0) / 2),
                width: door.tiledObject.width,
                height: door.tiledObject.height,
                collisionType: ex.CollisionType.Passive,
                filter: (actor) => {
                    if (actor.tags.has("player")) {
                        return true;
                    }
                    return false;
                },
                action: async () => {
                    console.log("从", this.sceneName, "传送到:", targetScene);
                    await engine.goToScene(targetScene);
                    const newScene = engine.currentScene;
                    // 查找玩家实体
                    const playerEntities = newScene.world.query([PlayerComponent]).entities.filter(e => e.hasTag('player'));
                    console.log("找到的玩家实体", playerEntities);
                    
                    if (playerEntities.length > 0) {
                        const player = playerEntities[0] as ex.Actor;
                        newScene.add(player);
                        player.pos = ex.vec(312, 155);
                        console.log("坐标移动", player.pos);
                        
                        (newScene as any).camera?.strategy?.lockToActor(player);
                    }
                }
            });
            const box = ex.Shape.Box(doorTrigger.width, doorTrigger.height);
            doorTrigger.collider.set(box);
            this.add(doorTrigger)
        }

        //实体世界
        const world = engine.currentScene.world;
        //注册系统
        world.add(new PlayerControlSystem(engine));
        world.add(new AnimationSystem());

    }
}