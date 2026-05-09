import { Scene, Physics } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { MovementComponent, AnimationComponent, HitStunComponent, AttackComponent } from '../ecs/Component';

export class MovementSystem extends System {
    update(entities: Entity[], _delta: number): void {
        for (const entity of entities) {
            if (!entity.active || !entity.hasComponent('movement')) {
                continue;
            }

            const sprite = entity.sprite;
            if (!sprite) continue;
            const body = sprite.body as Physics.Arcade.Body;

            const movement = entity.getComponent<MovementComponent>('movement')!;

            // 受击硬直期间：应用击退速度，忽略正常输入
            if (entity.hasComponent('hitstun')) {
                const hitStun = entity.getComponent<HitStunComponent>('hitstun')!;
                if (hitStun.stunTimer > 0) {
                    body.setVelocity(hitStun.knockbackX, hitStun.knockbackY);
                    continue;
                }
            }

            // 攻击期间速度归零
            if (entity.hasComponent('attack')) {
                const attack = entity.getComponent<AttackComponent>('attack')!;
                if (attack.isAttacking) {
                    body.setVelocity(0, 0);
                    continue;
                }
            }

            const speed = movement.isRunning ? movement.runSpeed : movement.walkSpeed;
            body.setVelocity(movement.dx * speed, movement.dy * speed);

            // 更新动画组件的面向与翻转
            if (entity.hasComponent('animation')) {
                const anim = entity.getComponent<AnimationComponent>('animation')!;

                if (movement.dy < 0 && Math.abs(movement.dy) >= Math.abs(movement.dx)) {
                    anim.facing = 'up';
                } else if (movement.dy > 0 && Math.abs(movement.dy) >= Math.abs(movement.dx)) {
                    anim.facing = 'down';
                } else if (movement.dx !== 0) {
                    anim.facing = 'right';
                }

                if (movement.dx < 0) {
                    sprite.setFlipX(true);
                } else if (movement.dx > 0) {
                    sprite.setFlipX(false);
                }
            }
        }
    }
}
