import { Scene, Physics } from 'phaser';
import { Entity } from '../ecs/Entity';
import {
    MovementComponent, AnimationComponent, AIComponent,
    RenderComponent, HealthComponent, AttackComponent,
    SpriteComponent, VisualComponent, DropComponent,
    AttributeComponent
} from '../ecs/Component';

// === 敌人碰撞体可调参数 ===
// human_idle sprite 80x80，origin (0.5, 0.5)。默认让 body 居中：offset = (80 - body) / 2 = 35
const ENEMY_BODY_WIDTH = 10;
const ENEMY_BODY_HEIGHT = 5;
const ENEMY_BODY_OFFSET_X = 35;
const ENEMY_BODY_OFFSET_Y = 42;

export class Enemy extends Entity {
    constructor(scene: Scene, x: number, y: number, dropTable: string = 'default_enemy') {
        super(scene);

        // 创建精灵并挂载到 SpriteComponent
        const sprite = scene.add.sprite(x, y, 'human_idle');
        scene.physics.add.existing(sprite);
        const body = sprite.body as Physics.Arcade.Body;
        body.setCollideWorldBounds(true);
        this.addComponent(new SpriteComponent(sprite));
        this.applyBodyConfig(ENEMY_BODY_WIDTH, ENEMY_BODY_HEIGHT, ENEMY_BODY_OFFSET_X, ENEMY_BODY_OFFSET_Y);

        // 视觉大小组件：与碰撞体保持一致
        const visual = new VisualComponent();
        visual.width = ENEMY_BODY_WIDTH;
        visual.height = ENEMY_BODY_HEIGHT;
        this.addComponent(visual);

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

