import * as ex from 'excalibur';
import { HealthComponent } from '../components/health-component';

const BAR_WIDTH = 20;
const BAR_HEIGHT = 3;

/**
 * 头顶血条：作为子 Actor 挂载到实体上，自动跟随移动
 * 用法: entity.addChild(new HealthBar(healthComp))
 */
export class HealthBar extends ex.Actor {
    private _health: HealthComponent;
    private _fgRect!: ex.Rectangle;

    constructor(healthComponent: HealthComponent, offsetY: number = -15) {
        super({
            pos: ex.vec(0, offsetY),
            z: 10,
            anchor: ex.Vector.Half
        });
        this._health = healthComponent;
    }

    override onInitialize(_engine: ex.Engine): void {
        // 背景条
        const bgActor = new ex.Actor({ anchor: ex.Vector.Half, z: 0 });
        bgActor.graphics.use(new ex.Rectangle({
            width: BAR_WIDTH,
            height: BAR_HEIGHT,
            color: ex.Color.fromHex('#333333')
        }));

        // 前景血量条（左对齐：pos.x 固定在背景左边缘，anchor.x=0）
        this._fgRect = new ex.Rectangle({
            width: BAR_WIDTH,
            height: BAR_HEIGHT,
            color: ex.Color.Green
        });
        const fgActor = new ex.Actor({
            pos: ex.vec(-BAR_WIDTH / 2, 0),
            anchor: new ex.Vector(0, 0.5),
            z: 1
        });
        fgActor.graphics.use(this._fgRect);

        this.addChild(bgActor);
        this.addChild(fgActor);
    }

    override onPostUpdate(_engine: ex.Engine, _delta: number): void {
        const ratio = Math.max(0, Math.min(1, this._health.hp / this._health.maxHp));
        this._fgRect.width = Math.max(0.01, BAR_WIDTH * ratio);
        if (ratio > 0.6) {
            this._fgRect.color = ex.Color.Green;
        } else if (ratio > 0.3) {
            this._fgRect.color = ex.Color.Yellow;
        } else {
            this._fgRect.color = ex.Color.Red;
        }
    }
}