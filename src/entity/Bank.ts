import { Scene, Physics } from 'phaser';
import { Entity } from '../ecs/Entity';
import {
    SpriteComponent, VisualComponent, BankNPCComponent
} from '../ecs/Component';

// === 银行 NPC 碰撞体可调参数 ===
// human_idle 80x80，居中：offset = (80 - 10) / 2 = 35
const BANK_BODY_WIDTH = 10;
const BANK_BODY_HEIGHT = 5;
const BANK_BODY_OFFSET_X = 35;
const BANK_BODY_OFFSET_Y = 42;

export class Bank extends Entity {
    constructor(scene: Scene, x: number, y: number, name: string = '银行职员') {
        super(scene);

        // 创建精灵 —— 使用角色 idle 精灵表第一帧，绿色着色
        const sprite = scene.add.sprite(x, y, 'human_idle', 0);
        sprite.setTint(0x44cc88);
        scene.physics.add.existing(sprite);
        const body = sprite.body as Physics.Arcade.Body;
        body.setImmovable(true);
        this.addComponent(new SpriteComponent(sprite));
        this.applyBodyConfig(BANK_BODY_WIDTH, BANK_BODY_HEIGHT, BANK_BODY_OFFSET_X, BANK_BODY_OFFSET_Y);

        // 视觉大小（与碰撞体一致）
        const visual = new VisualComponent();
        visual.width = BANK_BODY_WIDTH;
        visual.height = BANK_BODY_HEIGHT;
        this.addComponent(visual);

        // 银行 NPC 标记组件
        this.addComponent(new BankNPCComponent(name));
    }
}

