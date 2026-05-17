import { Scene, Physics } from 'phaser';
import { Entity } from '../ecs/Entity';
import {
    SpriteComponent, VisualComponent,
    StoreComponent, InventoryComponent,
    InventoryItem
} from '../ecs/Component';

// === 商店 NPC 碰撞体可调参数 ===
// human_idle 80x80，居中：offset = (80 - 10) / 2 = 35
const STORE_BODY_WIDTH = 10;
const STORE_BODY_HEIGHT = 5;
const STORE_BODY_OFFSET_X = 35;
const STORE_BODY_OFFSET_Y = 42;

export class Store extends Entity {
    constructor(
        scene: Scene,
        x: number,
        y: number,
        name: string,
        goods: InventoryItem[]
    ) {
        super(scene);

        // 创建精灵 —— 使用角色 idle 精灵表第一帧，蓝色着色
        const sprite = scene.add.sprite(x, y, 'human_idle', 0);
        sprite.setTint(0x4488ff);
        scene.physics.add.existing(sprite);
        const body = sprite.body as Physics.Arcade.Body;
        body.setImmovable(true);
        this.addComponent(new SpriteComponent(sprite));
        this.applyBodyConfig(STORE_BODY_WIDTH, STORE_BODY_HEIGHT, STORE_BODY_OFFSET_X, STORE_BODY_OFFSET_Y);

        // 视觉大小（与碰撞体一致）
        const visual = new VisualComponent();
        visual.width = STORE_BODY_WIDTH;
        visual.height = STORE_BODY_HEIGHT;
        this.addComponent(visual);

        // 商店组件
        const store = new StoreComponent(name);
        store.goods = goods;
        this.addComponent(store);

        // 商店也持有库存组件（用于玩家出售物品给商店）
        this.addComponent(new InventoryComponent(20));
    }
}

