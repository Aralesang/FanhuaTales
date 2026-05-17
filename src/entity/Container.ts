import { Scene, Physics } from 'phaser';
import { Entity } from '../ecs/Entity';
import { SpriteComponent, InventoryComponent, ContainerComponent, VisualComponent, ItemDefinition } from '../ecs/Component';
import { InventorySystem } from '../systems/InventorySystem';

export class Container extends Entity {
    constructor(
        scene: Scene,
        x: number,
        y: number,
        itemsMap: Record<string, ItemDefinition>,
        presetItems: Record<string, number>
    ) {
        super(scene);

        // 创建精灵 —— 使用宝箱1 spritesheet 的第 0 帧（关闭状态）
        const sprite = scene.add.sprite(x, y, '宝箱1', 0);
        scene.physics.add.existing(sprite);
        const body = sprite.body as Physics.Arcade.Body;
        body.setImmovable(true);
        // 碰撞体大小与视觉匹配（16x32）
        body.setSize(16, 16);
        body.setOffset(0, 16);
        this.addComponent(new SpriteComponent(sprite));

        // 视觉大小：图片为 16x32，但上半部分透明，实际可见箱体为 16x16
        const visual = new VisualComponent();
        visual.width = 16;
        visual.height = 16;
        this.addComponent(visual);

        // 容器标记
        this.addComponent(new ContainerComponent());

        // 库存组件（容量 20，与玩家相同）
        const inventory = new InventoryComponent(20);
        this.addComponent(inventory);

        // 根据 Tiled 自定义属性预置物品
        for (const [itemId, quantity] of Object.entries(presetItems)) {
            if (quantity > 0) {
                InventorySystem.addItem(inventory, itemsMap, itemId, quantity);
            }
        }
    }
}
