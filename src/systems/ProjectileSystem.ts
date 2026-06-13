import { Physics } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import {
    ProjectileComponent,
    SpriteComponent,
    HitStunComponent,
    AttributeComponent,
} from '../ecs/Component';

export class ProjectileSystem extends System {
    update(entities: Entity[], delta: number): void {
        for (const entity of entities) {
            if (!entity.hasComponent('projectile')) continue;

            const proj = entity.getComponent<ProjectileComponent>('projectile')!;
            const sprite = entity.getComponent<SpriteComponent>('sprite')?.sprite;
            if (!sprite) continue;

            // 移动投射物
            const moveDist = proj.speed * (delta / 1000);
            sprite.x += proj.directionX * moveDist;
            sprite.y += proj.directionY * moveDist;
            proj.traveledDistance += moveDist;

            // 超距销毁
            if (proj.traveledDistance >= proj.maxDistance) {
                entity.destroy();
                continue;
            }

            // 碰撞检测：与带 health 的实体进行距离判定
            for (const target of entities) {
                if (target === proj.owner) continue;
                if (!target.hasComponent('health')) continue;

                const targetSprite = target.getComponent<SpriteComponent>('sprite')?.sprite;
                if (!targetSprite) continue;
                const targetBody = targetSprite.body as Physics.Arcade.Body | undefined;
                if (!targetBody) continue;

                const tx = targetBody.x + targetBody.width / 2;
                const ty = targetBody.y + targetBody.height / 2;
                const dist = Math.sqrt(
                    (sprite.x - tx) * (sprite.x - tx) +
                    (sprite.y - ty) * (sprite.y - ty)
                );

                if (dist < proj.radius + Math.max(targetBody.width, targetBody.height) / 2) {
                    // 命中：计算实际伤害（考虑目标防御）
                    const targetAttr = target.getComponent<AttributeComponent>('attribute');
                    const defensePower = targetAttr?.defense ?? 0;
                    const rawDamage = proj.damage - defensePower;
                    const damage = Math.max(1, rawDamage);

                    if (!target.hasComponent('hitstun')) {
                        target.addComponent(new HitStunComponent());
                    }
                    const hitStun = target.getComponent<HitStunComponent>('hitstun')!;
                    hitStun.isHit = true;
                    hitStun.damage = damage;

                    // 击退方向：从投射物指向目标
                    const dx = tx - sprite.x;
                    const dy = ty - sprite.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    hitStun.knockbackX = (dx / len) * 120;
                    hitStun.knockbackY = (dy / len) * 120;
                    hitStun.stunTimer = 250;
                    hitStun.flashTimer = 250;
                    hitStun.hitAnimTimer = 250;

                    // 销毁投射物
                    entity.destroy();
                    break;
                }
            }
        }
    }
}
