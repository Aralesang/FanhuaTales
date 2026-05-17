import { Scene, Physics } from 'phaser';
import { Entity } from '../ecs/Entity';
import { SpriteComponent, InventoryComponent, ContainerComponent, VisualComponent, ItemDefinition } from '../ecs/Component';
import { InventorySystem } from '../systems/InventorySystem';

// === 容器（宝箱）碰撞体可调参数 ===
// 宝箱1 sprite 16x32，上半部分透明，下半 16x16 为可见箱体
const CONTAINER_BODY_WIDTH = 16;
const CONTAINER_BODY_HEIGHT = 16;
const CONTAINER_BODY_OFFSET_X = 0;
const CONTAINER_BODY_OFFSET_Y = 16;

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
        this.addComponent(new SpriteComponent(sprite));
        this.applyBodyConfig(CONTAINER_BODY_WIDTH, CONTAINER_BODY_HEIGHT, CONTAINER_BODY_OFFSET_X, CONTAINER_BODY_OFFSET_Y);

        // 视觉大小：与碰撞体保持一致
        const visual = new VisualComponent();
        visual.width = CONTAINER_BODY_WIDTH;
        visual.height = CONTAINER_BODY_HEIGHT;
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

