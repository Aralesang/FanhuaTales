import { Scene, Input, Tilemaps, GameObjects } from 'phaser';
import { Entity } from '../ecs/Entity';
import { RenderComponent, HealthComponent, SpriteComponent, VisualComponent, InventoryComponent, ItemDefinition, SettingsComponent, UIStateComponent } from '../ecs/Component';
import { Player } from '../entity/Player';
import { Enemy } from '../entity/Enemy';
import { Container } from '../entity/Container';
import { Store } from '../entity/Store';
import { InputSystem } from '../systems/InputSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { InventoryUISystem } from '../systems/InventoryUISystem';
import { SystemMenuSystem } from '../systems/SystemMenuSystem';
import { ContainerSystem } from '../systems/ContainerSystem';
import { DropSystem } from '../systems/DropSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { StoreSystem } from '../systems/StoreSystem';
import { StoreUISystem } from '../systems/StoreUISystem';
import { EnemyAISystem } from '../systems/EnemyAISystem';
import { AttackSystem } from '../systems/AttackSystem';
import { HitSystem } from '../systems/HitSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { AnimationSystem } from '../systems/AnimationSystem';

export class GameScene extends Scene {
    private entities: Entity[] = [];
    private map!: Tilemaps.Tilemap;
    private solidLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer | null = null;
    private debugKey!: Input.Keyboard.Key;
    private debugEnabled = false;

    // Debug 绘制层（攻击判定框等）
    public debugOverlay!: GameObjects.Graphics;

    // 血条映射：实体 -> 血条 Graphics
    private healthBars: Map<Entity, GameObjects.Graphics> = new Map();

    // ECS 系统
    private inputSystem!: InputSystem;
    private containerSystem!: ContainerSystem;
    private inventorySystem!: InventorySystem;
    private dropSystem!: DropSystem;
    private pickupSystem!: PickupSystem;
    private inventoryUISystem!: InventoryUISystem;
    private systemMenuSystem!: SystemMenuSystem;
    private storeSystem!: StoreSystem;
    private storeUISystem!: StoreUISystem;
    private enemyAISystem!: EnemyAISystem;
    private attackSystem!: AttackSystem;
    private hitSystem!: HitSystem;
    private movementSystem!: MovementSystem;
    private animationSystem!: AnimationSystem;

    constructor() {
        super({ key: 'GameScene' });
    }

    create(data: { mapKey?: string }): void {
        const mapKey = data.mapKey || 'village';

        // 全局道具定义表
        const itemsMap = this.cache.json.get('itemsMap') as Record<string, ItemDefinition>;

        // 创建 tilemap
        this.map = this.make.tilemap({ key: mapKey });

        // 添加 tilesets（key 需与 Tiled 中的 tileset name 对应）
        const surfaceTileset = this.map.addTilesetImage('surface', 'surface');
        const buildingTileset = this.map.addTilesetImage('building', 'building');
        const solidTileset = this.map.addTilesetImage('solid', 'solid');

        if (!surfaceTileset || !buildingTileset || !solidTileset) {
            console.error('Failed to load tilesets');
            return;
        }

        // 创建图层（自下而上绘制）
        this.map.createLayer('soil', surfaceTileset, 0, 0);
        this.map.createLayer('grass', surfaceTileset, 0, 0);
        this.map.createLayer('flower', buildingTileset, 0, 0);
        this.map.createLayer('building', buildingTileset, 0, 0);
        this.map.createLayer('building2', buildingTileset, 0, 0);
        this.map.createLayer('building3', buildingTileset, 0, 0);

        this.solidLayer = this.map.createLayer('solid', solidTileset, 0, 0);

        if (this.solidLayer) {
            this.solidLayer.setAlpha(0);
            this.solidLayer.setCollisionByExclusion([-1]);
        }

        // 设置物理世界边界为地图大小
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        // 从 Object Layer 读取玩家起点、敌人位置与相机参数
        let playerX = 240;
        let playerY = 160;
        let cameraZoom = 3;

        const objectLayer = this.map.getObjectLayer('Objects');
        if (objectLayer) {
            for (const obj of objectLayer.objects) {
                if (obj.type === 'Player' && obj.x != null && obj.y != null) {
                    playerX = obj.x;
                    playerY = obj.y;
                }
                if (obj.type === 'Enemy' && obj.x != null && obj.y != null) {
                    const enemy = new Enemy(this, obj.x, obj.y, 'default_enemy');
                    this.entities.push(enemy);
                }
                if (obj.type === 'Container' && obj.x != null && obj.y != null) {
                    const presetItems: Record<string, number> = {};
                    if (obj.properties) {
                        // 兼容多种 Tiled 属性格式：
                        // 1) 数组 [{ name, value }, ...]
                        // 2) 对象 { key: number }（简单数值）
                        // 3) 嵌套对象 { key: { quantity: number } }（Tiled 1.10+ 自定义类）
                        if (Array.isArray(obj.properties)) {
                            const props = obj.properties as Array<{ name: string; value: unknown }>;
                            for (const prop of props) {
                                const qty = this.extractQuantity(prop.value);
                                if (itemsMap[prop.name] && qty > 0) {
                                    presetItems[prop.name] = qty;
                                }
                            }
                        } else {
                            const props = obj.properties as Record<string, unknown>;
                            for (const [key, value] of Object.entries(props)) {
                                const qty = this.extractQuantity(value);
                                if (itemsMap[key] && qty > 0) {
                                    presetItems[key] = qty;
                                }
                            }
                        }
                    }
                    const container = new Container(this, obj.x, obj.y, itemsMap, presetItems);
                    this.entities.push(container);
                }
                if (obj.type === 'Store' && obj.x != null && obj.y != null) {
                    const storeGoods: { itemId: string; quantity: number }[] = [];
                    if (obj.properties) {
                        if (Array.isArray(obj.properties)) {
                            const props = obj.properties as Array<{ name: string; value: unknown }>;
                            for (const prop of props) {
                                const qty = this.extractQuantity(prop.value);
                                if (itemsMap[prop.name] && qty > 0) {
                                    storeGoods.push({ itemId: prop.name, quantity: qty });
                                }
                            }
                        } else {
                            const props = obj.properties as Record<string, unknown>;
                            for (const [key, value] of Object.entries(props)) {
                                const qty = this.extractQuantity(value);
                                if (itemsMap[key] && qty > 0) {
                                    storeGoods.push({ itemId: key, quantity: qty });
                                }
                            }
                        }
                    }
                    const storeName = obj.name || '商人';
                    const store = new Store(this, obj.x, obj.y, storeName, storeGoods);
                    this.entities.push(store);
                }
                if (obj.type === 'camera' && obj.properties) {
                    const props = obj.properties as Array<{ name: string; value: number }>;
                    const zoomProp = props.find(p => p.name === 'zoom');
                    if (zoomProp) {
                        cameraZoom = zoomProp.value;
                    }
                }
            }
        }

        // 创建玩家
        const player = new Player(this, playerX, playerY);
        this.entities.push(player);

        // 创建全局设置实体
        const settingsEntity = new Entity(this);
        settingsEntity.addComponent(new SettingsComponent());
        this.entities.push(settingsEntity);

        // 创建全局 UI 状态实体
        const uiStateEntity = new Entity(this);
        uiStateEntity.addComponent(new UIStateComponent());
        this.entities.push(uiStateEntity);

        // 给玩家背包添加初始道具
        const playerInventory = player.getComponent<InventoryComponent>('inventory')!;
        InventorySystem.addItem(playerInventory, itemsMap, 'gold_coin', 5);
        InventorySystem.addItem(playerInventory, itemsMap, 'health_potion', 1);
        InventorySystem.addItem(playerInventory, itemsMap, 'iron_sword', 1);

        // 应用外观与碰撞设置
        for (const entity of this.entities) {
            const spriteComp = entity.getComponent<SpriteComponent>('sprite');
            if (!spriteComp) continue;

            if (entity.hasComponent('render')) {
                const render = entity.getComponent<RenderComponent>('render')!;
                if (render.tint !== undefined) {
                    spriteComp.sprite.setTint(render.tint);
                }
            }
        }

        // 实体与碰撞层交互
        if (this.solidLayer) {
            for (const entity of this.entities) {
                const spriteComp = entity.getComponent<SpriteComponent>('sprite');
                if (spriteComp) {
                    this.physics.add.collider(spriteComp.sprite, this.solidLayer);
                }
            }
        }

        // 容器与所有其他有精灵的实体碰撞（防止穿过）
        for (const entity of this.entities) {
            if (!entity.hasComponent('container')) continue;
            const containerSprite = entity.getComponent<SpriteComponent>('sprite')?.sprite;
            if (!containerSprite) continue;
            for (const other of this.entities) {
                if (other === entity) continue;
                const otherSprite = other.getComponent<SpriteComponent>('sprite')?.sprite;
                if (otherSprite) {
                    this.physics.add.collider(containerSprite, otherSprite);
                }
            }
        }

        // 商店与所有其他有精灵的实体碰撞（防止穿过）
        for (const entity of this.entities) {
            if (!entity.hasComponent('store')) continue;
            const storeSprite = entity.getComponent<SpriteComponent>('sprite')?.sprite;
            if (!storeSprite) continue;
            for (const other of this.entities) {
                if (other === entity) continue;
                const otherSprite = other.getComponent<SpriteComponent>('sprite')?.sprite;
                if (otherSprite) {
                    this.physics.add.collider(storeSprite, otherSprite);
                }
            }
        }

        // 为所有拥有生命值的实体创建血条
        for (const entity of this.entities) {
            if (entity.hasComponent('health')) {
                this.createHealthBar(entity);
            }
        }

        // 初始化 Debug 覆盖层
        this.debugOverlay = this.add.graphics();
        this.debugOverlay.setDepth(9999);
        this.debugOverlay.visible = false;

        // 相机设置：通过 PlayerComponent 查找相机跟随目标
        const cameraTarget = this.entities.find(e => e.hasComponent('player'));
        const cameraTargetSprite = cameraTarget?.getComponent<SpriteComponent>('sprite')?.sprite;
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.setZoom(cameraZoom);
        if (cameraTargetSprite) {
            this.cameras.main.startFollow(cameraTargetSprite, true, 0.1, 0.1);
        }
        this.cameras.main.roundPixels = false;

        // 初始化 ECS 系统
        this.inputSystem = new InputSystem(this);
        this.containerSystem = new ContainerSystem(this);
        this.inventorySystem = new InventorySystem(this);
        this.dropSystem = new DropSystem(this);
        this.pickupSystem = new PickupSystem(this);
        this.inventoryUISystem = new InventoryUISystem(this);
        this.systemMenuSystem = new SystemMenuSystem(this);
        this.storeSystem = new StoreSystem(this);
        this.storeUISystem = new StoreUISystem(this);
        this.enemyAISystem = new EnemyAISystem(this);
        this.attackSystem = new AttackSystem(this);
        this.hitSystem = new HitSystem(this);
        this.movementSystem = new MovementSystem(this);
        this.animationSystem = new AnimationSystem(this);

        // Debug 开关：按 F9 切换碰撞器可视化
        this.debugKey = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.F9);
        this.debugKey.on('down', () => this.toggleDebug());

        // 阻止浏览器右键菜单（库存 UI 需要右键交互）
        this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /**
     * 为实体创建血条 UI
     */
    private createHealthBar(entity: Entity): void {
        const bar = this.add.graphics();
        bar.setDepth(100);
        this.healthBars.set(entity, bar);
        this.updateHealthBar(entity, bar);
    }

    /**
     * 更新单个血条的位置和宽度
     */
    private updateHealthBar(entity: Entity, bar: GameObjects.Graphics): void {
        const health = entity.getComponent<HealthComponent>('health')!;
        const ratio = Math.max(0, health.hp / health.maxHp);

        bar.clear();

        const spriteComp = entity.getComponent<SpriteComponent>('sprite');
        if (!spriteComp) return;
        const sprite = spriteComp.sprite;

        // 获取视觉大小（优先使用 VisualComponent，否则使用精灵尺寸）
        const visual = entity.getComponent<VisualComponent>('visual');
        const visualH = visual?.height ?? sprite.height;

        const barWidth = 24;
        const barHeight = 3;
        const x = sprite.x - barWidth / 2;
        const y = sprite.y - visualH / 2 - 6;

        // 背景（深灰）
        bar.fillStyle(0x333333, 1);
        bar.fillRect(x, y, barWidth, barHeight);

        // 前景（绿色），宽度按血量比例
        if (ratio > 0) {
            bar.fillStyle(0x00ff00, 1);
            bar.fillRect(x, y, barWidth * ratio, barHeight);
        }
    }

    /**
     * 切换物理调试绘制（碰撞器可视化、攻击判定框、solid 碰撞层）
     */
    private toggleDebug(): void {
        this.debugEnabled = !this.debugEnabled;
        this.physics.world.drawDebug = this.debugEnabled;

        if (this.debugEnabled) {
            this.physics.world.createDebugGraphic();
        } else {
            this.physics.world.debugGraphic?.clear();
        }

        this.solidLayer?.setAlpha(this.debugEnabled ? 0.4 : 0);
        this.debugOverlay.visible = this.debugEnabled;
        this.debugOverlay.clear();
    }

    /**
     * 从 Tiled 属性值中提取数量。
     * 支持格式：
     * - 简单数值: 10
     * - 嵌套对象: { quantity: 10 }
     */
    private extractQuantity(value: unknown): number {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return Number(value) || 0;
        if (value && typeof value === 'object') {
            const obj = value as Record<string, unknown>;
            if ('quantity' in obj) {
                return Number(obj.quantity) || 0;
            }
        }
        return 0;
    }

    update(_time: number, delta: number): void {
        this.entities = this.entities.filter(e => e.active);

        if (this.debugOverlay.visible) {
            this.debugOverlay.clear();
        }

        this.inputSystem.update(this.entities, delta);
        this.containerSystem.update(this.entities, delta);
        this.inventorySystem.update(this.entities, delta);
        this.enemyAISystem.update(this.entities, delta);
        this.hitSystem.update(this.entities, delta);
        this.dropSystem.update(this.entities, delta);
        this.pickupSystem.update(this.entities, delta);

        this.entities = this.entities.filter(e => e.active);

        this.attackSystem.update(this.entities, delta);
        this.movementSystem.update(this.entities, delta);
        this.animationSystem.update(this.entities, delta);
        this.inventoryUISystem.update(this.entities, delta);
        this.storeSystem.update(this.entities, delta);
        this.storeUISystem.update(this.entities, delta);
        this.systemMenuSystem.update(this.entities, delta);

        // 清理已销毁实体的血条
        for (const [entity, bar] of this.healthBars) {
            if (!entity.active) {
                bar.destroy();
                this.healthBars.delete(entity);
            }
        }

        // 同步所有活跃实体的血条
        for (const entity of this.entities) {
            if (entity.hasComponent('health')) {
                const bar = this.healthBars.get(entity);
                if (bar) {
                    this.updateHealthBar(entity, bar);
                }
            }
        }
    }
}
