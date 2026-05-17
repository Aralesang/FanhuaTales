import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { HealthComponent, HitStunComponent, AttackComponent } from '../ecs/Component';

export class HitSystem extends System {
    update(entities: Entity[], delta: number): void {
        for (const entity of entities) {
            if (!entity.hasComponent('health')) {
                continue;
            }

            const health = entity.getComponent<HealthComponent>('health')!;

            // 死亡检测
            if (health.hp <= 0) {
                entity.destroy();
                continue;
            }

            if (!entity.hasComponent('hitstun')) {
                continue;
            }

            const hitStun = entity.getComponent<HitStunComponent>('hitstun')!;

            // 处理新受击
            if (hitStun.isHit) {
                hitStun.isHit = false;
                health.hp -= hitStun.damage;

                // 播放受击音效
                this.scene.sound.play('hurt');

                // 受击时中断当前攻击，避免攻击动画被覆盖后 isAttacking 永远锁死
                if (entity.hasComponent('attack')) {
                    const attack = entity.getComponent<AttackComponent>('attack')!;
                    attack.isAttacking = false;
                    attack.hitCheckDelay = 0;
                    attack.hitCheckDuration = 0;
                    attack.attackDuration = 0;
                }

                // 生命值归零直接由下一轮死亡检测处理
                if (health.hp <= 0) {
                    continue;
                }
            }

            // 更新受击计时器
            if (hitStun.stunTimer > 0) {
                hitStun.stunTimer -= delta;
                if (hitStun.stunTimer <= 0) {
                    hitStun.stunTimer = 0;
                    hitStun.knockbackX = 0;
                    hitStun.knockbackY = 0;
                }
            }

            if (hitStun.flashTimer > 0) {
                hitStun.flashTimer -= delta;
                // 闪烁：每 50ms 切换一次透明度
                const flashPhase = Math.floor(hitStun.flashTimer / 50) % 2;
                const sprite = entity.sprite;
                if (sprite) {
                    sprite.alpha = flashPhase === 0 ? 0.3 : 1;
                }
                if (hitStun.flashTimer <= 0) {
                    hitStun.flashTimer = 0;
                    if (sprite) sprite.alpha = 1;
                }
            }

            if (hitStun.hitAnimTimer > 0) {
                hitStun.hitAnimTimer -= delta;
                if (hitStun.hitAnimTimer <= 0) {
                    hitStun.hitAnimTimer = 0;
                }
            }
        }
    }
}
