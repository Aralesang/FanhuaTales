import * as ex from 'excalibur';
import { StateMachineComponent } from '../components/state-machine-component';
import { AnimationComponent } from '../components/animation-component';
import { DirectionComponent } from '../components/direction-component';
import { Global } from '../global';
import { HealthComponent } from '../components/health-component';

/** 敌人（临时：使用与玩家相同的贴图和状态机） */
export class Enemy extends ex.Actor {
    private lastAttackTime: number = 0; // 上次攻击时间
    private attackCooldown: number = 1000; // 攻击冷却时间（毫秒）
    private speed: number = 30; // 每秒像素速度（可调）

    constructor(pos: ex.Vector) {
        super({
            pos: pos,
            width: 10,
            height: 8,
            anchor: new ex.Vector(0.5, 0.55),
            z: 4
        });
    }

    onInitialize(engine: ex.Engine): void {
        // 复用玩家的组件：方向、状态机、动画
        this.addComponent(new DirectionComponent(ex.Vector.Down));
        this.addComponent(new StateMachineComponent());
        this.addComponent(new AnimationComponent('human', this, ex.Color.Red));
        // 敌人有生命值，可被玩家攻击
        this.addComponent(new HealthComponent(3));
        this.body.collisionType = ex.CollisionType.Active;
        this.addTag('enemy');

        // 监听碰撞开始事件，用于伤害玩家
        this.on('collisionstart', (evt) => {
            if (evt.other.owner) {
                this.handleCollision(evt.other.owner);
            }
        });
        // 监听碰撞保持事件，用于在持续接触时也能触发冷却后的攻击
        this.on('precollision', (evt) => {
            if (evt.other.owner) {
                this.handleCollision(evt.other.owner);
            }
        });
    }

    /** 处理碰撞逻辑 */
    private handleCollision(other: ex.Entity) {
        // 检查碰撞对象是否是玩家
        if (other.hasTag('player')) {
            const now = Date.now();
            if (now - this.lastAttackTime >= this.attackCooldown) {
                const playerHealth = other.get(HealthComponent);
                if (playerHealth) {
                    // 对玩家造成 1 点伤害，并附加反馈效果
                    playerHealth.takeDamage(1, {
                        source: this,
                        knockback: 100, // 击退速度
                        stunMs: 300,    // 眩晕时间
                        flashMs: 300,   // 闪烁时间
                        flashTimes: 3   // 闪烁次数
                    });
                    this.lastAttackTime = now;
                    console.log(`敌人攻击了玩家！玩家剩余 HP: ${playerHealth.hp}`);
                }
            }
        }
    }

    onPreUpdate(engine: ex.Engine, delta: number): void {
        // 简单AI：当玩家在范围内时朝玩家移动并切换到 Walk 状态，否则 Idle
        const player = Global.localPlayer;
        const stateComp = this.get(StateMachineComponent);
        const directionComp = this.get(DirectionComponent);
        const transform = this.get(ex.TransformComponent);
        if (!player || !stateComp || !directionComp || !transform || !stateComp.fsm) {
            return;
        }

        // 尊重眩晕/击退期间不执行 AI
        const stunUntil = (this as any).__stunUntil as number | undefined;
        if (stunUntil && Date.now() < stunUntil) {
            // 保持受击状态（可扩展为受击动画）
            try { stateComp.fsm.go('Idle'); } catch (e) { /* ignore */ }
            return;
        }

        const toPlayer = player.pos.clone().sub(transform.pos);
        const dist = toPlayer.distance();
        const chaseRadius = 120;
        const deltaSeconds = delta / 1000;

        if (dist <= chaseRadius) {
            const dir = toPlayer.normalize();
            transform.pos.x += dir.x * this.speed * deltaSeconds;
            transform.pos.y += dir.y * this.speed * deltaSeconds;

            // 仅使用四方向之一以匹配现有贴图行
            const absX = Math.abs(dir.x);
            const absY = Math.abs(dir.y);
            if (absX > absY) {
                directionComp.direction = dir.x > 0 ? ex.Vector.Right : ex.Vector.Left;
            } else {
                directionComp.direction = dir.y > 0 ? ex.Vector.Down : ex.Vector.Up;
            }

            stateComp.fsm.go('Walk');
        } else {
            stateComp.fsm.go('Idle');
        }
    }
}
