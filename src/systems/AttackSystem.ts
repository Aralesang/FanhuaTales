import { Physics, GameObjects } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import {
    AttackComponent, AnimationComponent, HitStunComponent,
    AttributeComponent, SpriteComponent, EquipmentSlotComponent,
    AttackProfile, ItemDefinition
} from '../ecs/Component';

export class AttackSystem extends System {
    private previousAttackState: WeakMap<Entity, boolean> = new WeakMap();
    private hitTargets: WeakMap<Entity, Set<Entity>> = new WeakMap();
    /** 武器叠加 sprite：entity → 武器精灵 */
    private weaponSprites: Map<Entity, GameObjects.Sprite> = new Map();

    /** 空手（拳头）默认攻击配置 */
    private readonly FIST_PROFILE: AttackProfile = {
        radius: 6,
        offsetRight: { x: 10, y: 0 },
        offsetDown: { x: 0, y: 10 },
        offsetUp: { x: 0, y: -10 },
        baseDamage: 10,
        animKey: 'human_fist',
        soundKey: 'human_atk_sword_1',
        hitCheckDelay: 100,
        hitCheckDuration: 200,
        attackDuration: 400,
    };

    update(entities: Entity[], delta: number): void {
        for (const entity of entities) {
            if (!entity.hasComponent('attack')) {
                continue;
            }

            const attack = entity.getComponent<AttackComponent>('attack')!;
            const prev = this.previousAttackState.get(entity) ?? false;

            // 攻击状态上升沿：false → true，触发攻击行为
            if (attack.isAttacking && !prev) {
                this.startAttack(entity, entities);
            }

            // 攻击持续期间处理判定计时器与攻击结束
            if (attack.isAttacking) {
                this.processHitCheck(entity, entities, delta);
                this.syncWeaponSprite(entity);

                attack.attackDuration -= delta;
                if (attack.attackDuration <= 0) {
                    attack.isAttacking = false;
                    attack.hitCheckDelay = 0;
                    attack.hitCheckDuration = 0;
                    attack.attackDuration = 0;
                    this.hideWeaponSprite(entity);
                }
            } else if (!attack.isAttacking && prev) {
                this.hideWeaponSprite(entity);
            }

            this.previousAttackState.set(entity, attack.isAttacking);
        }
    }

    private startAttack(entity: Entity, _entities: Entity[]): void {
        const attack = entity.getComponent<AttackComponent>('attack')!;
        const anim = entity.getComponent<AnimationComponent>('animation')!;
        const sprite = entity.sprite;
        if (!sprite || !anim) return;

        // 硬直期间无法发动攻击
        if (entity.hasComponent('hitstun')) {
            const hitStun = entity.getComponent<HitStunComponent>('hitstun')!;
            if (hitStun.stunTimer > 0) {
                attack.isAttacking = false;
                attack.attackDuration = 0;
                return;
            }
        }

        const body = sprite.body as Physics.Arcade.Body | undefined;
        if (body) {
            body.setVelocity(0, 0);
        }

        const profile = this.getAttackProfile(entity);

        const spriteComp = entity.getComponent<SpriteComponent>('sprite');
        const skinSuffix = spriteComp?.skin ? `_${spriteComp.skin}` : '';
        const attackAnimKey = this.resolveAnimKey(profile.animKey, skinSuffix, anim.facing);
        sprite.play(attackAnimKey);

        // 武器叠加动画
        if (profile.weaponOverlay) {
            this.startWeaponAnimation(entity, sprite, anim.facing, profile.weaponOverlay);
        }

        try {
            this.scene.sound.play(profile.soundKey);
        } catch {
            // 音效播放失败不影响攻击逻辑
        }

        attack.hitCheckDelay = profile.hitCheckDelay;
        attack.hitCheckDuration = profile.hitCheckDuration;
        attack.attackDuration = profile.attackDuration;
        this.hitTargets.set(entity, new Set());
    }

    /** 获取 entity 当前适用的攻击配置：装备武器时用武器配置，否则用拳头默认配置 */
    private getAttackProfile(entity: Entity): AttackProfile {
        const itemsMap = this.scene.cache.json.get('items') as Record<string, ItemDefinition> | undefined;
        if (!entity.hasComponent('equipment_slots')) {
            return this.FIST_PROFILE;
        }
        const equipComp = entity.getComponent<EquipmentSlotComponent>('equipment_slots')!;
        if (!equipComp.weapon) {
            return this.FIST_PROFILE;
        }
        const def = itemsMap?.[equipComp.weapon.itemId];
        if (def?.equipment?.attackProfile) {
            return def.equipment.attackProfile;
        }
        return this.FIST_PROFILE;
    }

    private startWeaponAnimation(
        entity: Entity,
        ownerSprite: GameObjects.Sprite,
        facing: string,
        overlay: { key: string; skin?: string }
    ): void {
        const skinSuffix = overlay.skin ? `_${overlay.skin}` : '';
        const weaponAnimKey = this.resolveAnimKey(overlay.key, skinSuffix, facing);
        if (!this.scene.anims.exists(weaponAnimKey)) return;

        let weaponSprite = this.weaponSprites.get(entity);
        if (!weaponSprite) {
            weaponSprite = this.scene.add.sprite(ownerSprite.x, ownerSprite.y, overlay.key);
            weaponSprite.setDepth(ownerSprite.depth + 1);
            this.weaponSprites.set(entity, weaponSprite);
        }

        weaponSprite.setPosition(ownerSprite.x, ownerSprite.y);
        weaponSprite.setFlipX(ownerSprite.flipX);
        weaponSprite.setVisible(true);
        weaponSprite.play(weaponAnimKey);
    }

    private syncWeaponSprite(entity: Entity): void {
        const weaponSprite = this.weaponSprites.get(entity);
        if (!weaponSprite || !weaponSprite.visible) return;

        const sprite = entity.sprite;
        if (!sprite) return;

        weaponSprite.setPosition(sprite.x, sprite.y);
        weaponSprite.setFlipX(sprite.flipX);
    }

    private hideWeaponSprite(entity: Entity): void {
        const weaponSprite = this.weaponSprites.get(entity);
        if (weaponSprite) {
            weaponSprite.setVisible(false);
            weaponSprite.stop();
        }
    }

    private processHitCheck(attacker: Entity, entities: Entity[], dt: number): void {
        const attack = attacker.getComponent<AttackComponent>('attack')!;

        if (attack.hitCheckDelay > 0) {
            attack.hitCheckDelay -= dt;
            if (attack.hitCheckDelay < 0) {
                attack.hitCheckDelay = 0;
            }
            return;
        }

        if (attack.hitCheckDuration <= 0) {
            return;
        }

        attack.hitCheckDuration -= dt;
        this.checkAttackHit(attacker, entities);
    }

    private checkAttackHit(attacker: Entity, entities: Entity[]): void {
        const attackerSprite = attacker.sprite;
        if (!attackerSprite) return;
        const attackerBody = attackerSprite.body as Physics.Arcade.Body | undefined;
        if (!attackerBody) return;

        const profile = this.getAttackProfile(attacker);
        const anim = attacker.getComponent<AnimationComponent>('animation')!;

        const cx = attackerBody.x + attackerBody.width / 2;
        const cy = attackerBody.y + attackerBody.height / 2;

        let hx: number, hy: number;

        switch (anim.facing) {
            case 'right':
                hx = attackerSprite.flipX ? cx - profile.offsetRight.x : cx + profile.offsetRight.x;
                hy = cy + profile.offsetRight.y;
                break;
            case 'down':
                hx = cx + profile.offsetDown.x;
                hy = cy + profile.offsetDown.y;
                break;
            case 'up':
                hx = cx + profile.offsetUp.x;
                hy = cy + profile.offsetUp.y;
                break;
            default:
                hx = cx;
                hy = cy;
        }

        // Debug：绘制攻击判定区
        const overlay = (this.scene as { debugOverlay?: GameObjects.Graphics }).debugOverlay;
        if (overlay && overlay.visible) {
            overlay.lineStyle(2, 0xff0000, 0.8);
            overlay.strokeCircle(hx, hy, profile.radius);
            overlay.fillStyle(0xff0000, 0.15);
            overlay.fillCircle(hx, hy, profile.radius);
        }

        const alreadyHit = this.hitTargets.get(attacker) ?? new Set();

        for (const target of entities) {
            if (target === attacker) continue;
            if (!target.hasComponent('health')) continue;
            if (alreadyHit.has(target)) continue;

            const targetSprite = target.sprite;
            if (!targetSprite) continue;
            const targetBody = targetSprite.body as Physics.Arcade.Body | undefined;
            if (!targetBody) continue;
            const tx = targetBody.x + targetBody.width / 2;
            const ty = targetBody.y + targetBody.height / 2;

            const dist = Math.sqrt((hx - tx) * (hx - tx) + (hy - ty) * (hy - ty));
            if (dist < profile.radius + Math.max(targetBody.width, targetBody.height) / 2) {
                const attackerAttr = attacker.getComponent<AttributeComponent>('attribute');
                const targetAttr = target.getComponent<AttributeComponent>('attribute');
                const attackPower = attackerAttr?.attack ?? 0;
                const defensePower = targetAttr?.defense ?? 0;
                const rawDamage = profile.baseDamage + attackPower - defensePower;
                const damage = Math.max(1, rawDamage);

                if (!target.hasComponent('hitstun')) {
                    target.addComponent(new HitStunComponent());
                }
                const hitStun = target.getComponent<HitStunComponent>('hitstun')!;
                hitStun.isHit = true;
                hitStun.damage = damage;

                const dx = tx - cx;
                const dy = ty - cy;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                hitStun.knockbackX = (dx / len) * 120;
                hitStun.knockbackY = (dy / len) * 120;
                hitStun.stunTimer = 250;
                hitStun.flashTimer = 250;
                hitStun.hitAnimTimer = 250;

                alreadyHit.add(target);

                if (overlay && overlay.visible) {
                    overlay.lineStyle(2, 0x00ff00, 0.9);
                    overlay.strokeRect(targetBody.x, targetBody.y, targetBody.width, targetBody.height);
                }
            }
        }
    }

    /** 如果带 skin 的动画不存在，先回退到 default；如果连 default 都不存在，回退到 human_sword */
    private resolveAnimKey(base: string, skinSuffix: string, facing: string): string {
        const skinned = `${base}${skinSuffix}_${facing}`;
        if (this.scene.anims.exists(skinned)) {
            return skinned;
        }
        const defaulted = `${base}_${facing}`;
        if (this.scene.anims.exists(defaulted)) {
            return defaulted;
        }
        return `human_sword_${facing}`;
    }
}
