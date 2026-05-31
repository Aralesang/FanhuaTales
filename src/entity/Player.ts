import { Scene, Physics } from 'phaser';
import { Entity } from '../ecs/Entity';
import {
    MovementComponent, AnimationComponent, InputComponent,
    AttackComponent, PlayerComponent, HealthComponent,
    SpriteComponent, VisualComponent, InventoryComponent,
    EquipmentSlotComponent, AttributeComponent, HotbarComponent,
    BankComponent, BuffComponent, NeedsComponent
} from '../ecs/Component';

// ============================================================
// 玩家碰撞体可调参数（自由修改）
// ------------------------------------------------------------
// Player sprite 来自 human_idle，单帧尺寸 80x80 像素，origin 默认 (0.5, 0.5)
// 即 sprite.x / sprite.y 是 sprite 的中心坐标。
//
// body（物理碰撞体）相对 sprite 左上角 (0, 0) 定位。
//   - 让 body 居中在 sprite：OFFSET_X = (80 - BODY_WIDTH) / 2 = 35
//   - 让 body 落到脚底位置：增大 OFFSET_Y（如 50、55）
//   - 让 body 更窄：减小 BODY_WIDTH 并相应调大 OFFSET_X
// 调整后 body 视觉位置可按 F9 打开 Debug 模式查看（红框）
// ============================================================

/** 碰撞体宽度（像素） */
const PLAYER_BODY_WIDTH = 10;
/** 碰撞体高度（像素） */
const PLAYER_BODY_HEIGHT = 5;
/** 碰撞体相对 sprite 左上角的 X 偏移 */
const PLAYER_BODY_OFFSET_X = 35;
/** 碰撞体相对 sprite 左上角的 Y 偏移 */
const PLAYER_BODY_OFFSET_Y = 42;

export class Player extends Entity {
    constructor(scene: Scene, x: number, y: number) {
        super(scene);

        // 创建精灵并挂载到 SpriteComponent（使用 '肉' 皮肤）
        const sprite = scene.add.sprite(x, y, 'human_idle_肉');
        scene.physics.add.existing(sprite);
        const body = sprite.body as Physics.Arcade.Body;
        body.setCollideWorldBounds(true);
        this.addComponent(new SpriteComponent(sprite, '肉'));
        // 通过 BodyConfigComponent 配置碰撞体（数据与 body 同时设置，方便调试/未来动态调整）
        this.applyBodyConfig(PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT, PLAYER_BODY_OFFSET_X, PLAYER_BODY_OFFSET_Y);

        // 视觉大小组件：与碰撞体保持一致，用于距离/范围计算
        const visual = new VisualComponent();
        visual.width = PLAYER_BODY_WIDTH;
        visual.height = PLAYER_BODY_HEIGHT;
        this.addComponent(visual);

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

        // 快捷栏组件
        this.addComponent(new HotbarComponent());

        // 银行组件
        this.addComponent(new BankComponent());

        // Buff 组件（默认挂载，玩家可接收任何 buff；通过 pendingBuffs 申请添加）
        this.addComponent(new BuffComponent());

        // 需求组件（饥饿/口渴，默认满值；通过 pendingDeltas 申请变化）
        const needs = new NeedsComponent();
        needs.hunger = 100;
        needs.thirst = 100;
        needs.hungerTimer = needs.hungerDecayMs;
        needs.thirstTimer = needs.thirstDecayMs;
        this.addComponent(needs);

        // 生命值组件
        const health = new HealthComponent();
        health.hp = 100;
        health.maxHp = 100;
        this.addComponent(health);

        // 输入组件
        if (scene.input.keyboard) {
            const input = new InputComponent();
            input.cursors = scene.input.keyboard.createCursorKeys();
            input.upKey = scene.input.keyboard.addKey('W');
            input.downKey = scene.input.keyboard.addKey('S');
            input.leftKey = scene.input.keyboard.addKey('A');
            input.rightKey = scene.input.keyboard.addKey('D');
            input.shiftKey = scene.input.keyboard.addKey('SHIFT');
            input.inventoryKey = scene.input.keyboard.addKey('B');
            this.addComponent(input);
        } else {
            throw new Error('Keyboard input is not available');
        }
    }
}

