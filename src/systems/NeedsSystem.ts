import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { NeedsComponent } from '../ecs/Component';

/**
 * 需求系统（饥饿/口渴等）。严格 ECS 隔离：不暴露任何方法供外部调用。
 *
 * 入口：外部向 `NeedsComponent.pendingDeltas` 推入 `{ hunger?, thirst? }`，
 * 字段为正数表示恢复、负数表示消耗。
 *
 * 当前仅实现"应用 pending 变化"。饥饿/口渴的自然消耗（每秒减少等）逻辑后续在此处扩展。
 */
export class NeedsSystem extends System {
    update(entities: Entity[], _delta: number): void {
        for (const entity of entities) {
            if (!entity.active || !entity.hasComponent('needs')) continue;
            const needs = entity.getComponent<NeedsComponent>('needs')!;

            if (needs.pendingDeltas.length === 0) continue;

            for (const delta of needs.pendingDeltas) {
                if (delta.hunger !== undefined) {
                    const old = needs.hunger;
                    needs.hunger = this.clamp(needs.hunger + delta.hunger, 0, needs.maxHunger);
                    if (needs.hunger !== old) {
                        console.log(`[Needs] 饥饿: ${old} → ${needs.hunger}`);
                    }
                }
                if (delta.thirst !== undefined) {
                    const old = needs.thirst;
                    needs.thirst = this.clamp(needs.thirst + delta.thirst, 0, needs.maxThirst);
                    if (needs.thirst !== old) {
                        console.log(`[Needs] 口渴: ${old} → ${needs.thirst}`);
                    }
                }
            }
            needs.pendingDeltas.length = 0;
        }
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }
}
