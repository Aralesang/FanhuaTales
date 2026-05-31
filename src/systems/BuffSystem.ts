import { Scene } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { BuffComponent, BuffDefinition, PendingBuff, HealthComponent } from '../ecs/Component';

/**
 * Buff 系统（严格 ECS 隔离）：
 * - 不暴露任何静态/实例方法给外部调用
 * - 外部如需添加 buff，请直接 push 到 BuffComponent.pendingBuffs（纯数据 {buffId, duration}）
 * - 外部如需移除 buff，请直接 push buffId 到 BuffComponent.removeBuffIds
 *
 * update 流程：
 *   1) 把 pendingBuffs 中的字符串/数字请求实例化为 BuffInstance 并加入 buffs
 *   2) 按 removeBuffIds 清理对应 buff
 *   3) 推进每个 buff 的 nextTickIn / remainingDuration，触发效果并自动过期
 */
export class BuffSystem extends System {
    private buffsMap!: Record<string, BuffDefinition>;

    constructor(scene: Scene) {
        super(scene);
        this.buffsMap = scene.cache.json.get('buffs') as Record<string, BuffDefinition>;
    }

    update(entities: Entity[], delta: number): void {
        for (const entity of entities) {
            if (!entity.active || !entity.hasComponent('buff')) continue;
            const buffComp = entity.getComponent<BuffComponent>('buff')!;

            // 1. 处理外部 push 的待添加请求
            if (buffComp.pendingBuffs.length > 0) {
                for (const req of buffComp.pendingBuffs) {
                    this.instantiateBuff(buffComp, req);
                }
                buffComp.pendingBuffs.length = 0;
            }

            // 2. 处理外部 push 的移除请求
            if (buffComp.removeBuffIds.length > 0) {
                for (const removeId of buffComp.removeBuffIds) {
                    const idx = buffComp.buffs.findIndex(b => b.buffId === removeId);
                    if (idx >= 0) buffComp.buffs.splice(idx, 1);
                }
                buffComp.removeBuffIds.length = 0;
            }

            // 3. 推进已生效 buff 的计时器
            this.tickBuffs(entity, buffComp, delta);
        }
    }

    /** 将 PendingBuff（纯数据）解析为 BuffInstance（运行时数据）。相同 id 的 buff 持续时间叠加 */
    private instantiateBuff(buffComp: BuffComponent, req: PendingBuff): void {
        const def = this.buffsMap?.[req.buffId];
        if (!def) {
            console.warn(`[BuffSystem] 未知 buff: ${req.buffId}，已忽略`);
            return;
        }

        // 同 id buff 已存在：叠加持续时间（任一为永久则保持永久）
        const existing = buffComp.buffs.find(b => b.buffId === req.buffId);
        if (existing) {
            if (existing.remainingDuration === -1 || req.duration === -1) {
                existing.remainingDuration = -1;
            } else {
                existing.remainingDuration += req.duration;
            }
            return;
        }

        // 不存在：创建新实例
        buffComp.buffs.push({
            buffId: req.buffId,
            remainingDuration: req.duration,
            nextTickIn: def.effect.interval,
        });
    }

    /** 推进每个 buff 的计时器，触发 tick 效果，处理到期移除 */
    private tickBuffs(entity: Entity, buffComp: BuffComponent, delta: number): void {
        for (let i = buffComp.buffs.length - 1; i >= 0; i--) {
            const instance = buffComp.buffs[i];
            const def = this.buffsMap?.[instance.buffId];
            if (!def) {
                buffComp.buffs.splice(i, 1);
                continue;
            }

            // tick 倒计时
            instance.nextTickIn -= delta;
            if (instance.nextTickIn <= 0) {
                this.applyBuffEffect(entity, def);
                instance.nextTickIn += def.effect.interval;
                if (instance.nextTickIn <= 0) {
                    instance.nextTickIn = def.effect.interval;
                }
            }

            // 持续时间倒计时（-1 表示永久，不递减）
            if (instance.remainingDuration > 0) {
                instance.remainingDuration -= delta;
                if (instance.remainingDuration <= 0) {
                    console.log(`[Buff] ${def.name} 已结束`);
                    buffComp.buffs.splice(i, 1);
                }
            }
        }
    }

    /** 触发一次 buff 效果（根据 effect.type 分派） */
    private applyBuffEffect(entity: Entity, def: BuffDefinition): void {
        switch (def.effect.type) {
            case 'heal_over_time': {
                const health = entity.getComponent<HealthComponent>('health');
                if (!health || health.hp <= 0) return;
                const oldHp = health.hp;
                health.hp = Math.min(health.maxHp, health.hp + def.effect.value);
                if (health.hp !== oldHp) {
                    console.log(`[Buff] ${def.name}: 恢复 ${health.hp - oldHp} 点生命 (${oldHp} → ${health.hp})`);
                }
                break;
            }
            case 'damage_over_time': {
                const health = entity.getComponent<HealthComponent>('health');
                if (!health || health.hp <= 0) return;
                const oldHp = health.hp;
                health.hp = Math.max(0, health.hp - def.effect.value);
                if (health.hp !== oldHp) {
                    console.log(`[Buff] ${def.name}: 损失 ${oldHp - health.hp} 点生命 (${oldHp} → ${health.hp})`);
                }
                break;
            }
        }
    }
}
