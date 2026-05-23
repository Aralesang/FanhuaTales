import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { NeedsComponent } from '../ecs/Component';

/**
 * 需求系统（饥饿/口渴等）。严格 ECS 隔离：不暴露任何方法供外部调用。
 *
 * 入口：外部向 `NeedsComponent.pendingDeltas` 推入 `{ hunger?, thirst? }`，
 * 字段为正数表示恢复、负数表示消耗。
 *
 * 自然消耗：
 * - 饥饿每 hungerDecayMs 毫秒自动减少 1 点
 * - 口渴每 thirstDecayMs 毫秒自动减少 1 点
 * - 消耗率通过 NeedsComponent 的 hungerDecayMs / thirstDecayMs 配置
 */
export class NeedsSystem extends System {
    update(entities: Entity[], delta: number): void {
        for (const entity of entities) {
            if (!entity.active || !entity.hasComponent('needs')) continue;
            const needs = entity.getComponent<NeedsComponent>('needs')!;

            // 1. 应用 pendingDeltas（外部变化请求）
            if (needs.pendingDeltas.length > 0) {
                for (const deltaReq of needs.pendingDeltas) {
                    if (deltaReq.hunger !== undefined) {
                        const old = needs.hunger;
                        needs.hunger = this.clamp(needs.hunger + deltaReq.hunger, 0, needs.maxHunger);
                        if (needs.hunger !== old) {
                            console.log(`[Needs] 饥饿: ${old} → ${needs.hunger}`);
                        }
                    }
                    if (deltaReq.thirst !== undefined) {
                        const old = needs.thirst;
                        needs.thirst = this.clamp(needs.thirst + deltaReq.thirst, 0, needs.maxThirst);
                        if (needs.thirst !== old) {
                            console.log(`[Needs] 口渴: ${old} → ${needs.thirst}`);
                        }
                    }
                }
                needs.pendingDeltas.length = 0;
            }

            // 2. 自然消耗（随时间推移自动减少）
            this.applyDecay(needs, delta);
        }
    }

    private applyDecay(needs: NeedsComponent, delta: number): void {
        // 饥饿自然消耗
        if (needs.hunger > 0 && needs.hungerDecayMs > 0) {
            needs.hungerTimer -= delta;
            while (needs.hungerTimer <= 0 && needs.hunger > 0) {
                needs.hunger--;
                needs.hungerTimer += needs.hungerDecayMs;
            }
        }

        // 口渴自然消耗
        if (needs.thirst > 0 && needs.thirstDecayMs > 0) {
            needs.thirstTimer -= delta;
            while (needs.thirstTimer <= 0 && needs.thirst > 0) {
                needs.thirst--;
                needs.thirstTimer += needs.thirstDecayMs;
            }
        }
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}
