import * as ex from 'excalibur';
import { Player } from '../entitys/player';
import { Enemy } from '../entitys/enemy';
import { PlayerControlSystem } from '../systems/player-control-system';
import { AnimationSystem } from '../systems/animation-system';
import { Asset } from '../asset';
import { FactoryProps } from '@excaliburjs/plugin-tiled';
import { Global } from '../global';
import { TileMapSystem } from '../systems/tile-map-system';
import BaseScene from '../base-scene';
import { StateMachineSystem } from '../systems/state-machine-system';
import { DirectionSystem } from '../systems/direction-machine-system';

export class Village extends BaseScene {
    constructor() {
        super("village");
    }
    override onInitialize(engine: ex.Engine): void {
        //加载地图
        Asset.tileMapMap[this.sceneName].registerEntityFactory(
            "player-start", (props: FactoryProps) => {
                const player = new Player(props.worldPos, true);
                //相机跟随
                this.camera.strategy.lockToActor(player);
                //玩家记录到全局
                Global.localPlayer = player;
                return player;
            }
        );
        super.onInitialize(engine);
        const tileMap = Asset.tileMapMap[this.sceneName];
        //获取门
        const doors = tileMap.getObjectsByClassName("Door");
        for (const door of doors) {
            console.log("门:", door);
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
                action: () => {
                    console.log("传送到:", targetScene);
                    engine.goToScene(targetScene);
                    Global.localPlayer.pos = ex.vec(7, 84);
                }
            });
            const box = ex.Shape.Box(doorTrigger.width, doorTrigger.height);
            doorTrigger.collider.set(box);
            this.add(doorTrigger)
        }


        //实体世界
        const world = engine.currentScene.world;
        //注册系统
        world.add(new DirectionSystem());
        world.add(new StateMachineSystem());
        world.add(new AnimationSystem());
        world.add(new PlayerControlSystem(engine));

        // 注册 enemy 的 tiled factory（可在 Tiled map 中使用 object type: "enemy-start"）
        Asset.tileMapMap[this.sceneName].registerEntityFactory(
            "enemy-start", (props: FactoryProps) => {
                const enemy = new Enemy(props.worldPos);
                return enemy;
            }
        );

        // 立即在玩家右侧生成一个测试敌人，便于立刻在场景中查看效果
        if (Global.localPlayer) {
            const spawnPos = ex.vec(Global.localPlayer.pos.x + 40, Global.localPlayer.pos.y);
            const enemy = new Enemy(spawnPos);
            this.add(enemy);
        }

    }
}