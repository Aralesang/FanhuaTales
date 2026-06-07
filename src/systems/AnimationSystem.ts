import { Physics } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { MovementComponent, AnimationComponent, AttackComponent, HitStunComponent, SpriteComponent } from '../ecs/Component';

export class AnimationSystem extends System {
    update(entities: Entity[], _delta: number): void {
        for (const entity of entities) {
            if (!entity.active || !entity.hasComponent('animation')) {
                continue;
            }

            const sprite = entity.sprite;
            if (!sprite) continue;

            const anim = entity.getComponent<AnimationComponent>('animation')!;
            const spriteComp = entity.getComponent<SpriteComponent>('sprite');
            const skinSuffix = spriteComp?.skin ? `_${spriteComp.skin}` : '';

            // 受击动画优先级最高
            if (entity.hasComponent('hitstun')) {
                const hitStun = entity.getComponent<HitStunComponent>('hitstun')!;
                if (hitStun.hitAnimTimer > 0) {
                    const hitAnimKey = this.resolveAnimKey('human_idle', skinSuffix, anim.facing);
                    if (sprite.anims.currentAnim?.key !== hitAnimKey) {
                        try {
                            sprite.play(hitAnimKey);
                        } catch {
                            console.warn(`[AnimationSystem] 无法播放受击动画: ${hitAnimKey}`);
                        }
                    }
                    continue;
                }
            }

            // 攻击期间不切换移动动画
            if (entity.hasComponent('attack')) {
                const attack = entity.getComponent<AttackComponent>('attack')!;
                if (attack.isAttacking) {
                    continue;
                }
            }

            let newState = 'idle';

            if (entity.hasComponent('movement')) {
                const movement = entity.getComponent<MovementComponent>('movement')!;
                const body = sprite.body as Physics.Arcade.Body | undefined;
                if (!body) continue;
                const velocityX = body.velocity.x;
                const velocityY = body.velocity.y;
                const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

                if (speed < 10) {
                    newState = 'idle';
                } else if (speed <= movement.walkSpeed + 10) {
                    newState = 'walk';
                } else {
                    newState = 'run';
                }
            }

            const newAnimKey = this.resolveAnimKey(`human_${newState}`, skinSuffix, anim.facing);

            if (anim.currentState !== newState || sprite.anims.currentAnim?.key !== newAnimKey) {
                anim.currentState = newState;
                try {
                    sprite.play(newAnimKey);
                } catch {
                    console.warn(`[AnimationSystem] 无法播放移动动画: ${newAnimKey}`);
                }
            }
        }
    }

    /** 如果带 skin 的动画不存在或帧为空，回退到 default */
    private resolveAnimKey(base: string, skinSuffix: string, facing: string): string {
        const skinned = `${base}${skinSuffix}_${facing}`;
        if (this.hasValidFrames(skinned)) {
            return skinned;
        }
        const defaulted = `${base}_${facing}`;
        if (this.hasValidFrames(defaulted)) {
            return defaulted;
        }
        // 最终回退：尝试 human_idle
        const idleFallback = `human_idle_${facing}`;
        if (this.hasValidFrames(idleFallback)) {
            return idleFallback;
        }
        return skinned;
    }

    private hasValidFrames(key: string): boolean {
        if (!this.scene.anims.exists(key)) return false;
        const anim = this.scene.anims.get(key);
        return anim != null && anim.frames.length > 0;
    }
}
