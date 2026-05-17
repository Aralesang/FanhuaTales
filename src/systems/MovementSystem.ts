import { Physics } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { MovementComponent, AnimationComponent, HitStunComponent, AttackComponent, InputComponent } from '../ecs/Component';

export class MovementSystem extends System {
    update(entities: Entity[], _delta: number): void {
        for (const entity of entities) {
            if (!entity.active || !entity.hasComponent('movement')) {
                continue;
            }

            const sprite = entity.sprite;
            if (!sprite) continue;
            const body = sprite.body as Physics.Arcade.Body | undefined;
            if (!body) continue;

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

                let facingDx = movement.dx;
                let facingDy = movement.dy;

                // 有输入组件的实体（玩家）面向鼠标位置
                if (entity.hasComponent('input')) {
                    const input = entity.getComponent<InputComponent>('input')!;
                    facingDx = input.mouseX - sprite.x;
                    facingDy = input.mouseY - sprite.y;
                }

                if (facingDy < 0 && Math.abs(facingDy) >= Math.abs(facingDx)) {
                    anim.facing = 'up';
                } else if (facingDy > 0 && Math.abs(facingDy) >= Math.abs(facingDx)) {
                    anim.facing = 'down';
                } else if (facingDx !== 0 || facingDy !== 0) {
                    anim.facing = 'right';
                }

                if (facingDx < 0) {
                    sprite.setFlipX(true);
                } else if (facingDx > 0) {
                    sprite.setFlipX(false);
                }
            }
        }
    }
}
