import { Scene, GameObjects, Physics } from 'phaser';
import { Entity } from '../ecs/Entity';
import {
    MovementComponent, AnimationComponent, AIComponent,
    RenderComponent, HealthComponent, AttackComponent,
    SpriteComponent, VisualComponent, DropComponent,
    AttributeComponent
} from '../ecs/Component';

export class Enemy extends Entity {
    constructor(scene: Scene, x: number, y: number, dropTable: string = 'default_enemy') {
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
        this.addComponent(new MovementComponent());

        // 动画组件
        const animation = new AnimationComponent();
        animation.facing = 'down';
        this.addComponent(animation);

        // AI 组件
        const ai = new AIComponent();
        ai.patrolCenterX = x;
        ai.patrolCenterY = y;
        this.addComponent(ai);

        // 生命值组件
        const health = new HealthComponent();
        health.hp = 50;
        health.maxHp = 50;
        this.addComponent(health);

        // 攻击组件
        this.addComponent(new AttackComponent());

        // 属性组件
        const attr = new AttributeComponent();
        attr.baseAttack = 5;
        attr.baseDefense = 2;
        attr.attack = attr.baseAttack;
        attr.defense = attr.baseDefense;
        this.addComponent(attr);

        // 掉落组件
        this.addComponent(new DropComponent(dropTable));

        // 渲染组件：外观数据（红色区分于玩家）
        const render = new RenderComponent();
        render.tint = 0xff0000;
        this.addComponent(render);
    }
}
