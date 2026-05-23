import { Scene, GameObjects } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { FontConfig } from '../config/FontConfig';
import { NeedsComponent } from '../ecs/Component';

/**
 * 需求 UI 系统：在屏幕左上角血条下方依次渲染饥饿条和口渴条。
 * 严格 ECS：只读 NeedsComponent，不调用 NeedsSystem 的任何方法。
 *
 * 渲染参数与 GameScene.updatePlayerHud 中的血条保持一致（pad/barW/barH），
 * 使三条 HUD 在视觉上对齐。
 */
export class NeedsUISystem extends System {
    private hungerBar!: GameObjects.Graphics;
    private hungerText!: GameObjects.Text;
    private thirstBar!: GameObjects.Graphics;
    private thirstText!: GameObjects.Text;

    // 渲染参数（与玩家血条一致以保持对齐）
    private readonly PAD = 10;
    private readonly BAR_W = 100;
    private readonly BAR_H = 10;
    private readonly BAR_GAP = 4;

    constructor(scene: Scene) {
        super(scene);
        this.initUI();
    }

    private initUI(): void {
        this.hungerBar = this.scene.add.graphics();
        this.hungerBar.setDepth(9998);
        this.hungerBar.visible = false;

        this.hungerText = this.createText(0, 0, '', {
            fontSize: FontConfig.large.size,
            color: '#ffffff',
            fontFamily: FontConfig.large.family,
        });
        this.hungerText.setDepth(9999);
        this.hungerText.visible = false;

        this.thirstBar = this.scene.add.graphics();
        this.thirstBar.setDepth(9998);
        this.thirstBar.visible = false;

        this.thirstText = this.createText(0, 0, '', {
            fontSize: FontConfig.large.size,
            color: '#ffffff',
            fontFamily: FontConfig.large.family,
        });
        this.thirstText.setDepth(9999);
        this.thirstText.visible = false;
    }

    update(entities: Entity[], _delta: number): void {
        const player = entities.find(e => e.hasComponent('player'));
        const needs = player?.getComponent<NeedsComponent>('needs');
        if (!needs) {
            this.hideAll();
            return;
        }

        const cam = this.scene.cameras.main;
        const worldOrigin = cam.getWorldPoint(0, 0);

        const x = worldOrigin.x + this.PAD;
        // 血条占据 (PAD, PAD)~(PAD+BAR_W, PAD+BAR_H)，饥饿条/口渴条向下依次排列
        const hungerY = worldOrigin.y + this.PAD + this.BAR_H + this.BAR_GAP;
        const thirstY = hungerY + this.BAR_H + this.BAR_GAP;

        this.renderBar(this.hungerBar, this.hungerText, x, hungerY, needs.hunger, needs.maxHunger, 0xcc8844);
        this.renderBar(this.thirstBar, this.thirstText, x, thirstY, needs.thirst, needs.maxThirst, 0x44aacc);
    }

    private renderBar(
        bar: GameObjects.Graphics,
        text: GameObjects.Text,
        x: number,
        y: number,
        value: number,
        max: number,
        color: number,
    ): void {
        const ratio = Math.max(0, value / max);

        bar.clear();
        // 背景
        bar.fillStyle(0x333333, 1);
        bar.fillRoundedRect(x, y, this.BAR_W, this.BAR_H, 3);
        // 前景
        if (ratio > 0) {
            bar.fillStyle(color, 1);
            bar.fillRoundedRect(x, y, this.BAR_W * ratio, this.BAR_H, 3);
        }
        // 边框
        bar.lineStyle(1, 0x666688, 1);
        bar.strokeRoundedRect(x, y, this.BAR_W, this.BAR_H, 3);
        bar.visible = true;

        text.setPosition(x + this.BAR_W / 2, y + this.BAR_H / 2);
        text.setOrigin(0.5, 0.5);
        text.setScale(0.5);
        text.setText(`${Math.round(value)} / ${max}`);
        text.visible = true;
    }

    private hideAll(): void {
        this.hungerBar.visible = false;
        this.hungerText.visible = false;
        this.thirstBar.visible = false;
        this.thirstText.visible = false;
    }
}
