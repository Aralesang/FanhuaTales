import { Scene, GameObjects, Physics } from 'phaser';
import { Entity } from '../ecs/Entity';
import {
    SpriteComponent, VisualComponent,
    StoreComponent, InventoryComponent,
    ItemDefinition, InventoryItem
} from '../ecs/Component';

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
        body.setSize(10, 10, true);
        this.addComponent(new SpriteComponent(sprite));

        // 视觉大小（与角色相同）
        const visual = new VisualComponent();
        visual.width = 10;
        visual.height = 10;
        this.addComponent(visual);

        // 商店组件
        const store = new StoreComponent(name);
        store.goods = goods;
        this.addComponent(store);

        // 商店也持有库存组件（用于玩家出售物品给商店）
        this.addComponent(new InventoryComponent(20));
    }
}
