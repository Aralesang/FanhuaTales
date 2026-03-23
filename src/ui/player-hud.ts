import * as ex from 'excalibur';
import { HealthComponent } from '../components/health-component';

const PANEL_W = 180;
const PANEL_H = 56;
const PADDING = 8;
const BAR_W = 120;
const BAR_H = 12;
const AVATAR_SIZE = PANEL_H - PADDING * 2;

/**
 * 左上角玩家 HUD 血条
 * 接收 player Actor，懒加载 HealthComponent，避免 onInitialize 时序问题
 */
export class PlayerHUD extends ex.ScreenElement {
    private _player: ex.Actor;
    private _health: HealthComponent | null = null;
    private _canvas!: ex.Canvas;

    constructor(player: ex.Actor) {
        super({
            x: 10,
            y: 10,
            z: 1000,
            anchor: ex.Vector.Zero
        });
        this._player = player;
    }

    override onInitialize(_engine: ex.Engine): void {
        this._canvas = new ex.Canvas({
            width: PANEL_W,
            height: PANEL_H,
            cache: false,
            draw: (ctx) => this._draw(ctx)
        });
        // 与 SimpleLabel 相同：直接 use() 到自身
        this.graphics.use(this._canvas);
    }

    override onPostUpdate(_engine: ex.Engine, _delta: number): void {
        // 懒加载：等待 player.onInitialize 执行完毕后再取组件
        if (!this._health) {
            this._health = this._player.get(HealthComponent) as HealthComponent | null;
        }
        if (this._health) {
            this._canvas.flagDirty();
        }
    }

    private _draw(ctx: CanvasRenderingContext2D): void {
        if (!this._health) return;

        const hp = this._health.hp;
        const maxHp = this._health.maxHp;
        const ratio = Math.max(0, Math.min(1, hp / maxHp));

        // 面板背景
        ctx.clearRect(0, 0, PANEL_W, PANEL_H);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, PANEL_W, PANEL_H);

        // 头像框
        ctx.fillStyle = '#444444';
        ctx.fillRect(PADDING, PADDING, AVATAR_SIZE, AVATAR_SIZE);
        ctx.strokeStyle = '#888888';
        ctx.lineWidth = 1;
        ctx.strokeRect(PADDING, PADDING, AVATAR_SIZE, AVATAR_SIZE);

        // 头像文字
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('勇', PADDING + AVATAR_SIZE / 2, PADDING + AVATAR_SIZE / 2 - 7);
        ctx.fillText('士', PADDING + AVATAR_SIZE / 2, PADDING + AVATAR_SIZE / 2 + 9);

        const barX = PADDING + AVATAR_SIZE + PADDING;
        const barY = PADDING + 6;

        // HP 标签
        ctx.font = '9px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('HP', barX, barY);

        const fillBarY = barY + 14;

        // 血条背景
        ctx.fillStyle = '#330000';
        ctx.fillRect(barX, fillBarY, BAR_W, BAR_H);

        // 血量条
        if (ratio > 0.6) {
            ctx.fillStyle = '#22cc44';
        } else if (ratio > 0.3) {
            ctx.fillStyle = '#ddcc00';
        } else {
            ctx.fillStyle = '#cc2222';
        }
        ctx.fillRect(barX, fillBarY, Math.max(0, BAR_W * ratio), BAR_H);

        // 血条边框
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, fillBarY, BAR_W, BAR_H);

        // 数值文本
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 2;
        ctx.fillText(`${hp} / ${maxHp}`, barX + BAR_W / 2, fillBarY + BAR_H / 2);
        ctx.shadowBlur = 0;
    }
}

