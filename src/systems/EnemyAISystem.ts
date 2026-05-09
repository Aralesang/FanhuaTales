import { Scene, Physics } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { AIComponent, MovementComponent, AttackComponent, HitStunComponent } from '../ecs/Component';

export class EnemyAISystem extends System {
    update(entities: Entity[], _delta: number): void {
        // 查找玩家
        const player = entities.find(e => e.hasComponent('player'));
        if (!player) return;
        const playerSprite = player.sprite;
        if (!playerSprite || !playerSprite.body) return;

        const playerBody = playerSprite.body as Physics.Arcade.Body;
        const px = playerBody.x + playerBody.width / 2;
        const py = playerBody.y + playerBody.height / 2;

        for (const entity of entities) {
            if (!entity.hasComponent('ai') || !entity.hasComponent('movement')) {
                continue;
            }

            const ai = entity.getComponent<AIComponent>('ai')!;
            const movement = entity.getComponent<MovementComponent>('movement')!;

            // 受击硬直期间不移动
            if (entity.hasComponent('hitstun')) {
                const hitStun = entity.getComponent<HitStunComponent>('hitstun')!;
                if (hitStun.stunTimer > 0) {
                    movement.dx = 0;
                    movement.dy = 0;
                    continue;
                }
            }

            // 攻击期间不移动
            if (entity.hasComponent('attack')) {
                const attack = entity.getComponent<AttackComponent>('attack')!;
                if (attack.isAttacking) {
                    movement.dx = 0;
                    movement.dy = 0;
                    continue;
                }
            }

            const entitySprite = entity.sprite;
            if (!entitySprite || !entitySprite.body) continue;
            const entityBody = entitySprite.body as Physics.Arcade.Body;
            const ex = entityBody.x + entityBody.width / 2;
            const ey = entityBody.y + entityBody.height / 2;

            const dx = px - ex;
            const dy = py - ey;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // 在追逐范围内
            if (dist <= ai.chaseRange) {
                const len = dist || 1;
                const ndx = dx / len;
                const ndy = dy / len;

                // 在攻击范围内则发动攻击
                if (dist <= ai.attackRange) {
                    movement.dx = 0;
                    movement.dy = 0;

                    if (entity.hasComponent('attack')) {
                        const attack = entity.getComponent<AttackComponent>('attack')!;
                        if (!attack.isAttacking) {
                            attack.isAttacking = true;
                        }
                    }
                } else {
                    // 走向玩家
                    movement.dx = ndx;
                    movement.dy = ndy;
                }
            } else {
                // 超出追逐范围，原地 idle
                movement.dx = 0;
                movement.dy = 0;
            }
        }
    }
}
