import { Scene, Physics, GameObjects } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { AttackComponent, AnimationComponent, HitStunComponent, AttributeComponent } from '../ecs/Component';

export class AttackSystem extends System {
    private previousAttackState: WeakMap<Entity, boolean> = new WeakMap();
    private hitTargets: WeakMap<Entity, Set<Entity>> = new WeakMap();

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

                attack.attackDuration -= delta;
                if (attack.attackDuration <= 0) {
                    attack.isAttacking = false;
                    attack.hitCheckDelay = 0;
                    attack.hitCheckDuration = 0;
                    attack.attackDuration = 0;
                }
            }

            this.previousAttackState.set(entity, attack.isAttacking);
        }
    }

    private startAttack(entity: Entity, entities: Entity[]): void {
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

        const body = sprite.body as Physics.Arcade.Body;
        body.setVelocity(0, 0);

        const attackAnimKey = `human_sword_${anim.facing}`;
        sprite.play(attackAnimKey);

        try {
            this.scene.sound.play('human_atk_sword_1');
        } catch {
            // 音效播放失败不影响攻击逻辑
        }

        // 初始化判定参数：第 3 帧开始（frameRate=10，每帧约 100ms，延迟 200ms），持续 250ms
        attack.hitCheckDelay = 200;
        attack.hitCheckDuration = 250;
        attack.attackDuration = 600;   // 与动画时长匹配（6帧 @ 10fps = 600ms）
        this.hitTargets.set(entity, new Set());
    }

    private processHitCheck(attacker: Entity, entities: Entity[], dt: number): void {
        const attack = attacker.getComponent<AttackComponent>('attack')!;

        // 延迟倒计时
        if (attack.hitCheckDelay > 0) {
            attack.hitCheckDelay -= dt;
            if (attack.hitCheckDelay < 0) {
                attack.hitCheckDelay = 0;
            }
            return;
        }

        // 判定窗口已过
        if (attack.hitCheckDuration <= 0) {
            return;
        }

        // 在判定窗口中，递减持续时间
        attack.hitCheckDuration -= dt;

        // 执行攻击判定
        this.checkAttackHit(attacker, entities);
    }

    private checkAttackHit(attacker: Entity, entities: Entity[]): void {
        const attackerSprite = attacker.sprite;
        if (!attackerSprite) return;
        const attackerBody = attackerSprite.body as Physics.Arcade.Body;

        // 玩家中心坐标（判定区以此为中心，再根据方向偏移）
        const cx = attackerBody.x + attackerBody.width / 2;
        const cy = attackerBody.y + attackerBody.height / 2;

        const anim = attacker.getComponent<AnimationComponent>('animation')!;

        // ==================== 攻击判定区可调参数 ====================
        // 判定区半径（决定判定范围大小）
        const hitRadius = 10;

        // 各方向上的偏移量：判定区中心相对玩家中心的偏移
        // 正值表示向前（攻击方向），可自由调整
        const offsetRightX = 14;  // 向右/左攻击时的 X 偏移
        const offsetRightY = 0;   // 向右/左攻击时的 Y 偏移
        const offsetDownX = 0;    // 向下攻击时的 X 偏移
        const offsetDownY = 14;   // 向下攻击时的 Y 偏移
        const offsetUpX = 0;      // 向上攻击时的 X 偏移
        const offsetUpY = -14;    // 向上攻击时的 Y 偏移
        // ==========================================================

        let hx: number, hy: number;

        switch (anim.facing) {
            case 'right':
                hx = attackerSprite.flipX ? cx - offsetRightX : cx + offsetRightX;
                hy = cy + offsetRightY;
                break;
            case 'down':
                hx = cx + offsetDownX;
                hy = cy + offsetDownY;
                break;
            case 'up':
                hx = cx + offsetUpX;
                hy = cy + offsetUpY;
                break;
            default:
                hx = cx;
                hy = cy;
        }

        // Debug：绘制攻击判定区
        const overlay = (this.scene as { debugOverlay?: GameObjects.Graphics }).debugOverlay;
        if (overlay && overlay.visible) {
            overlay.lineStyle(2, 0xff0000, 0.8);
            overlay.strokeCircle(hx, hy, hitRadius);
            overlay.fillStyle(0xff0000, 0.15);
            overlay.fillCircle(hx, hy, hitRadius);
        }

        const alreadyHit = this.hitTargets.get(attacker) ?? new Set();

        for (const target of entities) {
            if (target === attacker) continue;
            if (!target.hasComponent('health')) continue;
            if (alreadyHit.has(target)) continue;

            const targetSprite = target.sprite;
            if (!targetSprite) continue;
            const targetBody = targetSprite.body as Physics.Arcade.Body;
            const tx = targetBody.x + targetBody.width / 2;
            const ty = targetBody.y + targetBody.height / 2;

            const dist = Math.sqrt((hx - tx) * (hx - tx) + (hy - ty) * (hy - ty));
            if (dist < hitRadius + Math.max(targetBody.width, targetBody.height) / 2) {
                // 命中，计算伤害（应用攻击者攻击力和被攻击者防御力）
                const attackerAttr = attacker.getComponent<AttributeComponent>('attribute');
                const targetAttr = target.getComponent<AttributeComponent>('attribute');
                const baseDamage = 25;
                const attackPower = attackerAttr?.attack ?? 0;
                const defensePower = targetAttr?.defense ?? 0;
                const rawDamage = baseDamage + attackPower - defensePower;
                const damage = Math.max(1, rawDamage);

                if (!target.hasComponent('hitstun')) {
                    target.addComponent(new HitStunComponent());
                }
                const hitStun = target.getComponent<HitStunComponent>('hitstun')!;
                hitStun.isHit = true;
                hitStun.damage = damage;

                // 击退方向：从攻击者中心指向目标
                const dx = tx - cx;
                const dy = ty - cy;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                hitStun.knockbackX = (dx / len) * 120;
                hitStun.knockbackY = (dy / len) * 120;
                hitStun.stunTimer = 250;
                hitStun.flashTimer = 250;
                hitStun.hitAnimTimer = 250;

                alreadyHit.add(target);

                // Debug：绘制被命中目标的判定高亮
                if (overlay && overlay.visible) {
                    overlay.lineStyle(2, 0x00ff00, 0.9);
                    overlay.strokeRect(targetBody.x, targetBody.y, targetBody.width, targetBody.height);
                }
            }
        }
    }
}
