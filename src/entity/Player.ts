import { Scene, GameObjects, Physics } from 'phaser';
import { Entity } from '../ecs/Entity';
import {
    MovementComponent, AnimationComponent, InputComponent,
    AttackComponent, PlayerComponent, HealthComponent,
    SpriteComponent, VisualComponent, InventoryComponent,
    EquipmentSlotComponent, AttributeComponent
} from '../ecs/Component';

export class Player extends Entity {
    constructor(scene: Scene, x: number, y: number) {
        super(scene);

        // 创建精灵并挂载到 SpriteComponent
        const sprite = scene.add.sprite(x, y, 'human_idle');
        scene.physics.add.existing(sprite);
        const body = sprite.body as Physics.Arcade.Body;
        body.setCollideWorldBounds(true);
        body.setSize(10, 10, true);
        this.addComponent(new SpriteComponent(sprite));

        // 视觉大小组件：角色实际视觉尺寸 10x10
        this.addComponent(new VisualComponent());

        // 移动组件
        const movement = new MovementComponent();
        movement.walkSpeed = 50;
        movement.runSpeed = 100;
        this.addComponent(movement);

        // 动画组件
        this.addComponent(new AnimationComponent());

        // 攻击组件
        this.addComponent(new AttackComponent());

        // 玩家标记组件
        this.addComponent(new PlayerComponent());

        // 库存组件
        this.addComponent(new InventoryComponent(20));

        // 装备槽组件
        this.addComponent(new EquipmentSlotComponent());

        // 属性组件
        this.addComponent(new AttributeComponent());

        // 生命值组件
        const health = new HealthComponent();
        health.hp = 100;
        health.maxHp = 100;
        this.addComponent(health);

        // 输入组件
        if (scene.input.keyboard) {
            const input = new InputComponent();
            input.cursors = scene.input.keyboard.createCursorKeys();
            input.attackKey = scene.input.keyboard.addKey('X');
            input.shiftKey = scene.input.keyboard.addKey('SHIFT');
            input.inventoryKey = scene.input.keyboard.addKey('B');
            this.addComponent(input);
        } else {
            throw new Error('Keyboard input is not available');
        }
    }
}
