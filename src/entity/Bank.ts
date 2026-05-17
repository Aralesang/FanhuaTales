import { Scene, GameObjects, Physics } from 'phaser';
import { Entity } from '../ecs/Entity';
import {
    SpriteComponent, VisualComponent, BankNPCComponent
} from '../ecs/Component';

export class Bank extends Entity {
    constructor(scene: Scene, x: number, y: number, name: string = '银行职员') {
        super(scene);

        // 创建精灵 —— 使用角色 idle 精灵表第一帧，绿色着色
        const sprite = scene.add.sprite(x, y, 'human_idle', 0);
        sprite.setTint(0x44cc88);
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

        // 银行 NPC 标记组件
        this.addComponent(new BankNPCComponent(name));
    }
}
