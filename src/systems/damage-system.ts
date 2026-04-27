import * as ex from 'excalibur';
import { HealthComponent } from '../components/health-component';
import { DeathMarkerComponent } from '../components/death-marker-component';
import { LootDropComponent } from '../components/loot-drop-component';
import { Asset } from '../asset';

export class DamageSystem extends ex.System {
    systemType = ex.SystemType.Update;
    public query!: ex.Query<typeof HealthComponent>;

    initialize(world: ex.World, scene: ex.Scene): void {
        console.log("DamageSystem");
        this.query = world.query([HealthComponent]);
    }

    update(elapsed: number): void {
        // 处理眩晕结束
        for (const entity of this.query.entities) {
            const health = entity.get(HealthComponent);
            if (health.stunUntil && Date.now() >= health.stunUntil) {
                health.stunUntil = undefined;
                // 清除速度
                if ((entity as ex.Actor).vel) {
                    (entity as ex.Actor).vel.x = 0;
                    (entity as ex.Actor).vel.y = 0;
                }
            }
            if (health.isDead()) {
                // 死亡处理：如果实体带有 LootDropComponent（敌人），
                // 则附加 DeathMarkerComponent，让 LootDropSystem 先处理掉落，
                // 而不是立即 kill。LootDropSystem 处理完毕后会标记 processed，
                // 下一帧 DamageSystem 再执行 kill() 完成清理。
                const lootComp = entity.get(LootDropComponent);
                const marker = entity.get(DeathMarkerComponent);
                if (lootComp && !marker) {
                    entity.addComponent(new DeathMarkerComponent());
                    // 此时不 kill，等待 LootDropSystem 处理
                    continue;
                }
                if (marker && !marker.processed) {
                    // 掉落系统尚未处理完毕，继续等待
                    continue;
                }
                entity.kill();
            }
        }
    }

    // 公共方法：应用伤害
    public applyDamage(entity: ex.Entity, amount: number, opts?: {
        source?: ex.Actor | { x: number; y: number },
        knockback?: number,
        stunMs?: number,
        flashMs?: number,
        flashTimes?: number
    }) {
        const health = entity.get(HealthComponent);
        if (!health) return;

        health.hp -= amount;

        // 播放受击音效
        try {
            if (amount > 0) {
                Asset.playSound('hurt');
            }
        } catch (e) {
            // 忽略播放失败
        }

        const owner = entity as ex.Actor;

        // 视觉反馈：闪烁
        if (owner && opts?.flashMs) {
            const flashTimes = opts.flashTimes ?? 3;
            const flashMs = opts.flashMs ?? 300;
            const interval = Math.max(20, Math.floor(flashMs / (flashTimes * 2)));
            let flashes = 0;
            const gfx = owner.get(ex.GraphicsComponent) as ex.GraphicsComponent | undefined;
            const originalOpacity = gfx?.opacity ?? 1;
            const iv = globalThis.setInterval(() => {
                if (gfx) {
                    gfx.opacity = gfx.opacity === originalOpacity ? 0.25 : originalOpacity;
                }
                flashes++;
                if (flashes >= flashTimes * 2) {
                    if (gfx) gfx.opacity = originalOpacity;
                    globalThis.clearInterval(iv);
                }
            }, interval);
            // 保险的清理
            globalThis.setTimeout(() => {
                try { if (gfx) gfx.opacity = originalOpacity; } catch (e) { /* ignore */ }
                globalThis.clearInterval(iv);
            }, flashMs + 50);
        }

        // 击退 + 眩晕
        if (owner && opts?.source && opts.knockback && opts.stunMs && opts.knockback > 0 && opts.stunMs > 0) {
            let srcPos: { x: number; y: number };
            if ((opts.source as ex.Actor).pos) {
                const s = opts.source as ex.Actor;
                srcPos = { x: s.pos.x, y: s.pos.y };
            } else {
                srcPos = opts.source as any;
            }
            const dirX = owner.pos.x - srcPos.x;
            const dirY = owner.pos.y - srcPos.y;
            const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
            const nx = dirX / len;
            const ny = dirY / len;
            // 设置速度实现击退
            try {
                owner.vel = owner.vel ?? ({} as any);
                owner.vel.x = nx * opts.knockback;
                owner.vel.y = ny * opts.knockback;
            } catch (e) {
                // 一次性位移
                owner.pos.x += nx * (opts.knockback * 0.016);
                owner.pos.y += ny * (opts.knockback * 0.016);
            }

            health.stunUntil = Date.now() + opts.stunMs;
        }
    }
}