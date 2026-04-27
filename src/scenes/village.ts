import * as ex from 'excalibur';
import { Player } from '../entitys/player';
import { Enemy } from '../entitys/enemy';
import { PlayerControlSystem } from '../systems/player-control-system';
import { AnimationSystem } from '../systems/animation-system';
import { Asset } from '../asset';
import { FactoryProps } from '@excaliburjs/plugin-tiled';
import { TileMapSystem } from '../systems/tile-map-system';
import SceneBase from './scene-base';
import { StateMachineSystem } from '../systems/state-machine-system';
import { DirectionSystem } from '../systems/direction-machine-system';
import { AISystem } from '../systems/ai-system';
import { DamageSystem } from '../systems/damage-system';
import { SkillSystem } from '../systems/skill-system';
import { InventorySystem } from '../systems/inventory-system';
import { PickupSystem } from '../systems/pickup-system';
import { ItemUseSystem } from '../systems/item-use-system';
import { ItemFactory, ItemType } from '../item-base';
import { Item } from '../entitys/item';
import { PlayerHUD } from '../ui/player-hud';
import { Chest } from '../entitys/chest';
import { InventoryComponent } from '../components/inventory-component';
import { ChestSystem } from '../systems/chest-system';
import { HotbarUI } from '../ui/hotbar-ui';
import { NPC } from '../entitys/npc';
import { NPCSystem } from '../systems/npc-system';



export class Village extends SceneBase {
    public damageSystem!: DamageSystem;

    constructor() {
        super("village");
    }
    override onInitialize(engine: ex.Engine): void {
        //加载地图
        let player: Player | undefined;
        Asset.tileMapMap[this.sceneName].registerEntityFactory(
            "Player", (props: FactoryProps) => {
                player = new Player(props.worldPos, true);
                //相机跟随
                this.camera.strategy.lockToActor(player);
                return player;
            }
        );
         // 注册 enemy 的 tiled factory（可在 Tiled map 中使用 object type: "Enemy"）
        Asset.tileMapMap[this.sceneName].registerEntityFactory(
            "Enemy", (props: FactoryProps) => {
                const enemy = new Enemy(props.worldPos);
                return enemy;
            }
        );

        // 注册 NPC 的 tiled factory（可在 Tiled map 中使用 object type: "NPC"）
        Asset.tileMapMap[this.sceneName].registerEntityFactory(
            "NPC", (props: FactoryProps) => {
                const npc = new NPC(props.worldPos, {
                    name: props.name,
                    animationType: props.object.properties.get("animation_type") as string | undefined,
                    interactDistance: props.object.properties.get("interact_distance") as number | undefined,
                });
                return npc;
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
                action: async () => {
                    console.log("从", this.sceneName, "传送到:", targetScene);
                    await engine.goToScene(targetScene);
                    const newScene = engine.currentScene;
                    if (player) {
                        newScene.add(player);
                        if (targetScene === 'interior') {
                            player.pos = ex.vec(7, 84);
                        }
                        (newScene as any).camera?.strategy?.lockToActor(player);
                    }
                }
            });
            const box = ex.Shape.Box(doorTrigger.width, doorTrigger.height);
            doorTrigger.collider.set(box);
            this.add(doorTrigger)
        }


        //实体世界
        const world = this.world;
        //注册系统
        world.add(new DirectionSystem());
        world.add(new StateMachineSystem());
        world.add(new SkillSystem());
        world.add(new AnimationSystem());
        world.add(new PlayerControlSystem(engine));
        world.add(new AISystem());
        this.damageSystem = new DamageSystem();
        world.add(this.damageSystem);
        world.add(new InventorySystem());
        world.add(new PickupSystem());
        world.add(new ItemUseSystem());
        world.add(new ChestSystem(engine));
        world.add(new NPCSystem(engine));

       
        // 添加左上角玩家 HUD 血条
        if (player) {
            this.add(new PlayerHUD(player));
            this.add(new HotbarUI(player));
        }

        // 添加测试物品
        if (player) {
            // 从配置文件加载测试物品
            const createConfigItem = (itemId: string, quantity: number = 1) => {
                const itemConfig = Asset.itemDataMap?.get(itemId);
                if (itemConfig) {
                    const item = ItemFactory.fromConfig(itemConfig);
                    item.quantity = quantity;
                    return item;
                }
                return null;
            };

            const healthPotion = createConfigItem('health_potion');
            const sword = createConfigItem('iron_sword');
            const goldCoin = createConfigItem('gold_coin');

            if (healthPotion) {
                const item1 = new Item(ex.vec(player.pos.x + 20, player.pos.y), healthPotion);
                this.add(item1);
            }
            if (sword) {
                const item2 = new Item(ex.vec(player.pos.x - 20, player.pos.y), sword);
                this.add(item2);
            }
            if (goldCoin) {
                const item3 = new Item(ex.vec(player.pos.x, player.pos.y + 20), goldCoin);
                this.add(item3);
            }

            const chest = new Chest(ex.vec(player.pos.x + 60, player.pos.y + 10), '旅行木箱');
            const chestInventory = chest.get(InventoryComponent);
            if (chestInventory) {
                const chestPotion = createConfigItem('health_potion', 3);
                const chestCoin = createConfigItem('gold_coin', 15);
                const chestSword = createConfigItem('iron_sword');

                if (chestPotion) {
                    InventorySystem.addItem(chestInventory, chestPotion);
                }
                if (chestCoin) {
                    InventorySystem.addItem(chestInventory, chestCoin);
                }
                if (chestSword) {
                    InventorySystem.addItem(chestInventory, chestSword);
                }
            }
            this.add(chest);

            const npc = new NPC(ex.vec(player.pos.x - 60, player.pos.y - 20), { name: '旅行商人' });
            const npcInventory = npc.get(InventoryComponent);
            if (npcInventory) {
                const npcPotion = createConfigItem("health_potion", 5);
                const npcCoin = createConfigItem("gold_coin", 100);
                const npcSword = createConfigItem("iron_sword");
                const npcArmor = createConfigItem("leather_armor");

                if (npcPotion) InventorySystem.addItem(npcInventory, npcPotion);
                if (npcCoin) InventorySystem.addItem(npcInventory, npcCoin);
                if (npcSword) InventorySystem.addItem(npcInventory, npcSword);
                if (npcArmor) InventorySystem.addItem(npcInventory, npcArmor);
            }
            this.add(npc);
        }

    }
}