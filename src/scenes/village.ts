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

function parseTint(value: unknown): ex.Color | undefined {
    if (typeof value !== 'string') return undefined;
    const lower = value.toLowerCase();
    switch (lower) {
        case 'blue': return ex.Color.Blue;
        case 'red': return ex.Color.Red;
        case 'green': return ex.Color.Green;
        case 'yellow': return ex.Color.Yellow;
        case 'cyan': return ex.Color.Cyan;
        case 'magenta': return ex.Color.Magenta;
        case 'white': return ex.Color.White;
        case 'black': return ex.Color.Black;
        case 'gray':
        case 'grey': return ex.Color.Gray;
    }
    if (lower.startsWith('#')) {
        try { return ex.Color.fromHex(lower); } catch { /* ignore */ }
    }
    return undefined;
}

export class Village extends SceneBase {
    public damageSystem!: DamageSystem;

    constructor() {
        super("village");
    }
    override onInitialize(engine: ex.Engine): void {
        // 从配置文件加载物品的辅助函数
        const createConfigItem = (itemId: string, quantity: number = 1) => {
            const itemConfig = Asset.itemDataMap?.get(itemId);
            if (itemConfig) {
                const item = ItemFactory.fromConfig(itemConfig);
                item.quantity = quantity;
                return item;
            }
            return null;
        };

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
                return new NPC(props.worldPos, {
                    name: props.name,
                    animationType: props.object.properties.get("animation_type") as string | undefined,
                    interactDistance: props.object.properties.get("interact_distance") as number | undefined,
                    tint: parseTint(props.object.properties.get("tint")) ?? ex.Color.Blue,
                });
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

        // 初始化 NPC 默认商品（必须在 super.onInitialize 之后，此时所有 Tiled 实体已完成 onInitialize）
        for (const actor of this.actors) {
            if (!actor.tags.has('npc')) continue;
            const npcInventory = actor.get(InventoryComponent);
            if (!npcInventory) continue;
            const npcPotion = createConfigItem('health_potion', 5);
            const npcCoin = createConfigItem('gold_coin', 100);
            const npcSword = createConfigItem('iron_sword');
            const npcArmor = createConfigItem('leather_armor');
            if (npcPotion) InventorySystem.addItem(npcInventory, npcPotion);
            if (npcCoin) InventorySystem.addItem(npcInventory, npcCoin);
            if (npcSword) InventorySystem.addItem(npcInventory, npcSword);
            if (npcArmor) InventorySystem.addItem(npcInventory, npcArmor);
        }

        // 添加左上角玩家 HUD 血条
        if (player) {
            this.add(new PlayerHUD(player));
            this.add(new HotbarUI(player));
        }

        // 给玩家背包预置物品和金币
        if (player) {
            const playerInventory = player.get(InventoryComponent);
            if (playerInventory) {
                const playerPotion = createConfigItem('health_potion', 3);
                const playerSword = createConfigItem('iron_sword');
                const playerCoin = createConfigItem('gold_coin', 50);
                if (playerPotion) InventorySystem.addItem(playerInventory, playerPotion);
                if (playerSword) InventorySystem.addItem(playerInventory, playerSword);
                if (playerCoin) InventorySystem.addItem(playerInventory, playerCoin);
            }
        }

        // 添加掉落在地上的测试物品
        if (player) {
            const groundPotion = createConfigItem('health_potion');
            const groundSword = createConfigItem('iron_sword');
            const groundCoin = createConfigItem('gold_coin');

            if (groundPotion) {
                this.add(new Item(ex.vec(player.pos.x + 20, player.pos.y), groundPotion));
            }
            if (groundSword) {
                this.add(new Item(ex.vec(player.pos.x - 20, player.pos.y), groundSword));
            }
            if (groundCoin) {
                this.add(new Item(ex.vec(player.pos.x, player.pos.y + 20), groundCoin));
            }

            const chest = new Chest(ex.vec(player.pos.x + 60, player.pos.y + 10), '旅行木箱');
            this.add(chest);
            const chestInventory = chest.get(InventoryComponent);
            if (chestInventory) {
                const chestPotion = createConfigItem('health_potion', 3);
                const chestCoin = createConfigItem('gold_coin', 15);
                const chestSword = createConfigItem('iron_sword');
                if (chestPotion) InventorySystem.addItem(chestInventory, chestPotion);
                if (chestCoin) InventorySystem.addItem(chestInventory, chestCoin);
                if (chestSword) InventorySystem.addItem(chestInventory, chestSword);
            }
        }

    }
}