import { Scene, Input, Physics, Tilemaps, GameObjects } from 'phaser';
import { Entity } from '../ecs/Entity';
import { FontConfig } from '../config/FontConfig';
import { RenderComponent, HealthComponent, SpriteComponent, VisualComponent, InventoryComponent, ItemDefinition, SettingsComponent, UIStateComponent } from '../ecs/Component';
import { Player } from '../entity/Player';
import { Enemy } from '../entity/Enemy';
import { Container } from '../entity/Container';
import { Store } from '../entity/Store';
import { Bank } from '../entity/Bank';
import { InputSystem } from '../systems/InputSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { InventoryUISystem } from '../systems/InventoryUISystem';
import { SystemMenuSystem } from '../systems/SystemMenuSystem';
import { ContainerSystem } from '../systems/ContainerSystem';
import { DropSystem } from '../systems/DropSystem';
import { PickupSystem } from '../systems/PickupSystem';
import { StoreSystem } from '../systems/StoreSystem';
import { StoreUISystem } from '../systems/StoreUISystem';
import { BankSystem } from '../systems/BankSystem';
import { BankUISystem } from '../systems/BankUISystem';
import { HotbarUISystem } from '../systems/HotbarUISystem';
import { EnemyAISystem } from '../systems/EnemyAISystem';
import { AttackSystem } from '../systems/AttackSystem';
import { HitSystem } from '../systems/HitSystem';
import { MovementSystem } from '../systems/MovementSystem';
import { AnimationSystem } from '../systems/AnimationSystem';

interface DoorData {
    x: number;
    y: number;
    width: number;
    height: number;
    targetScene: string;
    /** 目标地图中要传送到的 Spawn 对象的 id */
    targetId: string;
}

export class GameScene extends Scene {
    private entities: Entity[] = [];
    private map: Tilemaps.Tilemap | null = null;
    private solidLayer: Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer | null = null;
    private debugKey!: Input.Keyboard.Key;
    private debugEnabled = false;
    private doors: DoorData[] = [];

    // 当前地图的 layer/collider 引用，便于切换地图时清理
    private mapLayers: (Tilemaps.TilemapLayer | Tilemaps.TilemapGPULayer)[] = [];
    private mapColliders: Physics.Arcade.Collider[] = [];

    // Debug 绘制层（攻击判定框等）
    public debugOverlay!: GameObjects.Graphics;

    // 血条映射：实体 -> 血条 Graphics
    private healthBars: Map<Entity, GameObjects.Graphics> = new Map();

    // 左上角玩家 HUD
    private playerHudBar!: GameObjects.Graphics;
    private playerHudText!: GameObjects.Text;

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
    private bankSystem!: BankSystem;
    private bankUISystem!: BankUISystem;
    private hotbarUISystem!: HotbarUISystem;
    private enemyAISystem!: EnemyAISystem;
    private attackSystem!: AttackSystem;
    private hitSystem!: HitSystem;
    private movementSystem!: MovementSystem;
    private animationSystem!: AnimationSystem;

    constructor() {
        super({ key: 'GameScene' });
    }

    /**
     * 场景初始化：一次性创建全局实体、HUD、ECS 系统、Debug 工具，
     * 然后调用 loadMap() 加载初始地图。地图切换时不会重新执行 create。
     */
    create(data: { mapKey?: string }): void {
        const initialMapKey = data.mapKey || 'village';
        const itemsMap = this.cache.json.get('itemsMap') as Record<string, ItemDefinition>;

        // 全局设置实体（持久，不随地图切换销毁）
        const settingsEntity = new Entity(this);
        settingsEntity.addComponent(new SettingsComponent());
        this.entities.push(settingsEntity);

        // 全局 UI 状态实体（持久）
        const uiStateEntity = new Entity(this);
        uiStateEntity.addComponent(new UIStateComponent());
        this.entities.push(uiStateEntity);

        // Debug 覆盖层（攻击判定框等）
        this.debugOverlay = this.add.graphics();
        this.debugOverlay.setDepth(9999);
        this.debugOverlay.visible = false;

        // 左上角玩家 HUD
        this.playerHudBar = this.add.graphics();
        this.playerHudBar.setDepth(9998);

        this.playerHudText = this.add.text(0, 0, '', {
            fontSize: FontConfig.large.size,
            color: '#ffffff',
            fontFamily: FontConfig.large.family,
            resolution: 3,
        });
        this.playerHudText.setDepth(9999);

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
        this.bankSystem = new BankSystem(this);
        this.bankUISystem = new BankUISystem(this);
        this.hotbarUISystem = new HotbarUISystem(this);
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

        // 加载初始地图（首次进入会创建玩家）
        this.loadMap(initialMapKey);

        // 给玩家初始道具（仅首次进入）
        const player = this.entities.find(e => e.hasComponent('player'));
        if (player) {
            const playerInventory = player.getComponent<InventoryComponent>('inventory')!;
            InventorySystem.addItem(playerInventory, itemsMap, 'gold_coin', 5);
            InventorySystem.addItem(playerInventory, itemsMap, 'health_potion', 1);
            InventorySystem.addItem(playerInventory, itemsMap, 'iron_sword', 1);
        }
    }

    /**
     * 加载新地图。玩家、settings、uistate 实体始终保留并跨地图复用；
     * 其他实体（敌人、容器、商店、银行 NPC）按新地图配置重新生成。
     * 玩家 sprite 不会被销毁，只会被移动到目标 Spawn 对象的位置。
     *
     * @param mapKey  目标地图 key（对应 maps-map.json）
     * @param spawnId 可选；传入时按 id 匹配目标地图的 Spawn 对象，找不到则抛错。
     *                未传入时使用地图的 Player 类型对象作为初始出生点（首次进入游戏）。
     */
    private loadMap(mapKey: string, spawnId?: string): void {
        const itemsMap = this.cache.json.get('itemsMap') as Record<string, ItemDefinition>;

        // === 1. 清理旧地图相关资源 ===
        for (const collider of this.mapColliders) {
            collider.destroy();
        }
        this.mapColliders = [];

        for (const layer of this.mapLayers) {
            layer.destroy();
        }
        this.mapLayers = [];
        this.solidLayer = null;

        if (this.map) {
            this.map.destroy();
            this.map = null;
        }

        this.doors = [];

        // === 2. 销毁非持久实体（保留 player、settings、uistate）===
        const persistent: Entity[] = [];
        const toRemove: Entity[] = [];
        for (const entity of this.entities) {
            if (
                entity.hasComponent('player') ||
                entity.hasComponent('settings') ||
                entity.hasComponent('uistate')
            ) {
                persistent.push(entity);
            } else {
                toRemove.push(entity);
            }
        }
        for (const entity of toRemove) {
            const bar = this.healthBars.get(entity);
            if (bar) {
                bar.destroy();
                this.healthBars.delete(entity);
            }
            entity.destroy();
        }
        this.entities = persistent;

        // === 3. 加载新 tilemap ===
        this.map = this.make.tilemap({ key: mapKey });

        // === 4. 动态加载 tilesets（key 必须与 Tiled 中 tileset name 一致）===
        const tilesetObjects: Tilemaps.Tileset[] = [];
        for (const ts of this.map.tilesets) {
            const tileset = this.map.addTilesetImage(ts.name, ts.name);
            if (tileset) {
                tilesetObjects.push(tileset);
            } else {
                console.warn(`[GameScene] Tileset "${ts.name}" 加载失败，请检查 BootScene 是否已预加载对应图片`);
            }
        }
        if (tilesetObjects.length === 0) {
            console.error('[GameScene] 没有任何 tileset 加载成功');
            return;
        }

        // === 5. 创建图层（自下而上，按 Tiled JSON 顺序）===
        for (const layerData of this.map.layers) {
            const layer = this.map.createLayer(layerData.name, tilesetObjects, 0, 0);
            if (!layer) continue;
            this.mapLayers.push(layer);
            if (layerData.name === 'solid') {
                this.solidLayer = layer;
                layer.setAlpha(0);
                layer.setCollisionByExclusion([-1]);
            }
        }

        // === 6. 设置物理世界边界 ===
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        // === 7. 读取 Object Layer ===
        let cameraZoom = 3;
        // 收集所有 Spawn（按 id 索引），供 Door 跳转使用
        const spawns: Map<string, { x: number; y: number }> = new Map();
        // 首次进入时的回退出生点（Tiled Player 类型对象）
        let playerObjX: number | undefined;
        let playerObjY: number | undefined;

        const objectLayer = this.map.getObjectLayer('Objects');
        // 兼容地图对象层使用中文等其他名称：若 'Objects' 不存在，则遍历所有对象层
        const objectLayers = objectLayer ? [objectLayer] : this.map.objects;
        for (const layer of objectLayers) {
            for (const obj of layer.objects) {
                if (obj.type === 'Player' && obj.x != null && obj.y != null) {
                    playerObjX = obj.x;
                    playerObjY = obj.y;
                }
                if (obj.type === 'Spawn' && obj.x != null && obj.y != null) {
                    const props = this.parseTiledProperties(obj.properties);
                    const id = this.extractIdString(props.id);
                    if (id) {
                        spawns.set(id, { x: obj.x, y: obj.y });
                    }
                }
                if (obj.type === 'Enemy' && obj.x != null && obj.y != null) {
                    const enemy = new Enemy(this, obj.x, obj.y, 'default_enemy');
                    this.entities.push(enemy);
                }
                if (obj.type === 'Container' && obj.x != null && obj.y != null) {
                    const presetItems: Record<string, number> = {};
                    if (obj.properties) {
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
                if (obj.type === 'Bank' && obj.x != null && obj.y != null) {
                    const bankName = obj.name || '银行职员';
                    const bank = new Bank(this, obj.x, obj.y, bankName);
                    this.entities.push(bank);
                }
                if (obj.type === 'Door' && obj.x != null && obj.y != null) {
                    const props = this.parseTiledProperties(obj.properties);
                    const targetScene = String(props.target_scene || '');
                    const targetId = this.extractIdString(props.id);
                    if (targetScene && targetId) {
                        this.doors.push({
                            x: obj.x,
                            y: obj.y,
                            width: obj.width || 32,
                            height: obj.height || 32,
                            targetScene,
                            targetId,
                        });
                    } else {
                        console.warn(`[GameScene] Door 缺少 target_scene 或 id 属性，已忽略 (x=${obj.x}, y=${obj.y})`);
                    }
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

        // === 7.5 根据 spawnId 或回退规则确定玩家出生点 ===
        let playerSpawnX: number;
        let playerSpawnY: number;
        if (spawnId !== undefined) {
            const spawn = spawns.get(spawnId);
            if (!spawn) {
                console.error(`[GameScene] 地图 ${mapKey} 收集到的 Spawn keys =`, Array.from(spawns.keys()));
                throw new Error(`地图 ${mapKey} 中找不到 id 为 ${spawnId} 的 Spawn`);
            }
            playerSpawnX = spawn.x;
            playerSpawnY = spawn.y;
        } else if (playerObjX !== undefined && playerObjY !== undefined) {
            playerSpawnX = playerObjX;
            playerSpawnY = playerObjY;
        } else {
            playerSpawnX = 240;
            playerSpawnY = 160;
        }

        // === 8. 处理玩家：首次进入则创建，否则移到出生点 ===
        let player = this.entities.find(e => e.hasComponent('player'));
        if (!player) {
            player = new Player(this, playerSpawnX, playerSpawnY);
            this.entities.push(player);
        } else {
            const playerSprite = player.getComponent<SpriteComponent>('sprite')?.sprite;
            if (playerSprite) {
                playerSprite.setPosition(playerSpawnX, playerSpawnY);
                const body = playerSprite.body as Physics.Arcade.Body | undefined;
                if (body) {
                    body.reset(playerSpawnX, playerSpawnY);
                }
            }
        }

        // === 9. 应用外观（tint）与渲染层级 ===
        // 实体 sprite depth=10：高于地图图层（默认 0），低于掉落物（50）、血条（100）、UI（1000+）
        for (const entity of this.entities) {
            const spriteComp = entity.getComponent<SpriteComponent>('sprite');
            if (!spriteComp) continue;
            spriteComp.sprite.setDepth(10);
            if (entity.hasComponent('render')) {
                const render = entity.getComponent<RenderComponent>('render')!;
                if (render.tint !== undefined) {
                    spriteComp.sprite.setTint(render.tint);
                }
            }
        }

        // === 10. 实体与 solid 碰撞层 ===
        if (this.solidLayer) {
            for (const entity of this.entities) {
                const spriteComp = entity.getComponent<SpriteComponent>('sprite');
                if (spriteComp) {
                    const collider = this.physics.add.collider(spriteComp.sprite, this.solidLayer);
                    this.mapColliders.push(collider);
                }
            }
        }

        // === 11. 容器/商店/银行 NPC 与其他实体互相碰撞（防止穿过）===
        const blockingTypes: string[] = ['container', 'store', 'bank_npc'];
        for (const type of blockingTypes) {
            for (const entity of this.entities) {
                if (!entity.hasComponent(type)) continue;
                const npcSprite = entity.getComponent<SpriteComponent>('sprite')?.sprite;
                if (!npcSprite) continue;
                for (const other of this.entities) {
                    if (other === entity) continue;
                    const otherSprite = other.getComponent<SpriteComponent>('sprite')?.sprite;
                    if (otherSprite) {
                        const collider = this.physics.add.collider(npcSprite, otherSprite);
                        this.mapColliders.push(collider);
                    }
                }
            }
        }

        // === 12. 为所有拥有生命值的实体创建血条（玩家血条若已存在则保留）===
        for (const entity of this.entities) {
            if (entity.hasComponent('health') && !this.healthBars.has(entity)) {
                this.createHealthBar(entity);
            }
        }

        // === 13. 相机：跟随玩家、设置地图边界 ===
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.setZoom(cameraZoom);
        const playerSprite = player.getComponent<SpriteComponent>('sprite')?.sprite;
        if (playerSprite) {
            this.cameras.main.startFollow(playerSprite, true, 0.1, 0.1);
        }
        this.cameras.main.roundPixels = false;
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

        const visual = entity.getComponent<VisualComponent>('visual');
        const visualH = visual?.height ?? sprite.height;

        const barWidth = 24;
        const barHeight = 3;
        const x = sprite.x - barWidth / 2;
        const y = sprite.y - visualH / 2 - 6;

        bar.fillStyle(0x333333, 1);
        bar.fillRect(x, y, barWidth, barHeight);

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
     * 支持格式：简单数值 / 嵌套对象 { quantity }
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

    /**
     * 统一解析 Tiled 属性（支持数组和对象两种格式）
     */
    private parseTiledProperties(properties: unknown): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        if (!properties) return result;
        if (Array.isArray(properties)) {
            for (const prop of properties as Array<{ name: string; value: unknown }>) {
                result[prop.name] = prop.value;
            }
        } else if (typeof properties === 'object') {
            Object.assign(result, properties);
        }
        return result;
    }

    /**
     * 从属性值中提取 id 字符串，兼容多种 Tiled 解析后的格式：
     * - 简单 number/string：直接转字符串
     * - 嵌套对象 { value: ... }：取 value 字段（Tiled 1.10+ 自定义类）
     * - 空 / undefined：返回空字符串
     */
    private extractIdString(value: unknown): string {
        if (value === null || value === undefined) return '';
        if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
            return String(value);
        }
        if (typeof value === 'object') {
            const obj = value as Record<string, unknown>;
            if ('value' in obj && obj.value !== null && obj.value !== undefined) {
                return String(obj.value);
            }
        }
        return '';
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
        this.hotbarUISystem.update(this.entities, delta);
        this.storeSystem.update(this.entities, delta);
        this.storeUISystem.update(this.entities, delta);
        this.bankSystem.update(this.entities, delta);
        this.bankUISystem.update(this.entities, delta);
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

        // 更新左上角玩家 HUD
        this.updatePlayerHud();

        // 检测玩家是否进入传送门
        this.checkDoorTeleport();
    }

    // ============================================================
    // 传送门
    // ============================================================

    private checkDoorTeleport(): void {
        const player = this.entities.find(e => e.hasComponent('player'));
        if (!player) return;
        const playerSprite = player.getComponent<SpriteComponent>('sprite')?.sprite;
        if (!playerSprite) return;

        const px = playerSprite.x;
        const py = playerSprite.y;

        for (const door of this.doors) {
            if (
                px >= door.x && px < door.x + door.width &&
                py >= door.y && py < door.y + door.height
            ) {
                this.loadMap(door.targetScene, door.targetId);
                return;
            }
        }
    }

    /**
     * 更新左上角玩家血量 HUD（跟随相机视口左上角）
     */
    private updatePlayerHud(): void {
        const player = this.entities.find(e => e.hasComponent('player') && e.hasComponent('health'));
        if (!player) {
            this.playerHudBar.visible = false;
            this.playerHudText.visible = false;
            return;
        }

        const health = player.getComponent<HealthComponent>('health')!;
        const ratio = Math.max(0, health.hp / health.maxHp);

        const cam = this.cameras.main;
        const worldOrigin = cam.getWorldPoint(0, 0);
        const pad = 10;
        const barW = 100;
        const barH = 10;

        const x = worldOrigin.x + pad;
        const y = worldOrigin.y + pad;

        this.playerHudBar.clear();
        this.playerHudBar.fillStyle(0x333333, 1);
        this.playerHudBar.fillRoundedRect(x, y, barW, barH, 3);

        const hpColor = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xccaa22 : 0xcc3333;
        if (ratio > 0) {
            this.playerHudBar.fillStyle(hpColor, 1);
            this.playerHudBar.fillRoundedRect(x, y, barW * ratio, barH, 3);
        }

        this.playerHudBar.lineStyle(1, 0x666688, 1);
        this.playerHudBar.strokeRoundedRect(x, y, barW, barH, 3);
        this.playerHudBar.visible = true;

        this.playerHudText.setPosition(x + barW / 2, y + barH / 2);
        this.playerHudText.setOrigin(0.5, 0.5);
        this.playerHudText.setScale(0.5);
        this.playerHudText.setText(`${health.hp} / ${health.maxHp}`);
        this.playerHudText.visible = true;
    }
}
