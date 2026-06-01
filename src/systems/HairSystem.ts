import { GameObjects } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { SpriteComponent, AnimationComponent, AttackComponent } from '../ecs/Component';

/**
 * 发型叠加系统：为带有 hair 配置的角色叠加发型精灵，与角色动画帧同步。
 *
 * 工作原理：
 * - 每帧读取角色当前播放的动画 key（如 human_idle_肉_right）
 * - 提取状态名（idle/walk/run/sword/fist）
 * - 播放对应的发型动画（hair_idle_right / hair_walk_right 等）
 * - 发型精灵的位置、flipX 与角色完全同步
 */
export class HairSystem extends System {
    private hairSprites: Map<Entity, GameObjects.Sprite> = new Map();

    update(entities: Entity[], _delta: number): void {
        for (const entity of entities) {
            if (!entity.active || !entity.hasComponent('sprite') || !entity.hasComponent('animation')) {
                continue;
            }

            const spriteComp = entity.getComponent<SpriteComponent>('sprite')!;
            if (!spriteComp.hair) continue;

            const animComp = entity.getComponent<AnimationComponent>('animation')!;
            const ownerSprite = spriteComp.sprite;

            // 获取或创建发型精灵
            let hairSprite = this.hairSprites.get(entity);
            if (!hairSprite) {
                hairSprite = this.scene.add.sprite(ownerSprite.x, ownerSprite.y, spriteComp.hair);
                hairSprite.setDepth(ownerSprite.depth + 1);
                this.hairSprites.set(entity, hairSprite);
            }

            // 同步位置和翻转
            hairSprite.setPosition(ownerSprite.x, ownerSprite.y);
            hairSprite.setFlipX(ownerSprite.flipX);

            // 确定当前应播放的发型状态
            const hairState = this.getHairState(entity, ownerSprite);
            const skinSuffix = spriteComp.hairSkin ? `_${spriteComp.hairSkin}` : '';
            const hairAnimKey = this.resolveAnimKey(`${spriteComp.hair}_${hairState}`, skinSuffix, animComp.facing);

            if (hairSprite.anims.currentAnim?.key !== hairAnimKey) {
                hairSprite.play(hairAnimKey);
            }
        }

        // 清理已销毁实体的发型精灵
        for (const [entity, hairSprite] of this.hairSprites) {
            if (!entity.active) {
                hairSprite.destroy();
                this.hairSprites.delete(entity);
            }
        }
    }

    /**
     * 根据角色当前状态推断发型动画状态。
     * 优先读取角色当前播放的动画 key，提取状态名。
     */
    private getHairState(entity: Entity, ownerSprite: GameObjects.Sprite): string {
        const currentAnimKey = ownerSprite.anims.currentAnim?.key;

        if (currentAnimKey) {
            // 匹配 human_{state}{_skin}_{direction}
            const match = currentAnimKey.match(/^human_([a-z]+)(?:_[^_]+)?_(right|down|up)$/);
            if (match) {
                return match[1]; // idle, walk, run, sword, fist
            }
        }

        // 回退：根据组件数据推断
        if (entity.hasComponent('attack')) {
            const attack = entity.getComponent<AttackComponent>('attack')!;
            if (attack.isAttacking) {
                return 'sword';
            }
        }

        const animComp = entity.getComponent<AnimationComponent>('animation');
        return animComp?.currentState ?? 'idle';
    }

    /** 如果带 skin 的动画不存在，回退到 default；如果连 default 都不存在，回退到 idle */
    private resolveAnimKey(base: string, skinSuffix: string, facing: string): string {
        const skinned = `${base}${skinSuffix}_${facing}`;
        if (this.scene.anims.exists(skinned)) {
            return skinned;
        }
        const defaulted = `${base}_${facing}`;
        if (this.scene.anims.exists(defaulted)) {
            return defaulted;
        }
        // 最终回退：尝试 hair_idle_{direction}
        const idleFallback = base.replace(/hair_[a-z]+$/, `hair_idle_${facing}`);
        if (this.scene.anims.exists(idleFallback)) {
            return idleFallback;
        }
        return `hair_idle_${facing}`;
    }
}
