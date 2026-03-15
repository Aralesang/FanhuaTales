import * as ex from 'excalibur';
import { AIComponent } from '../components/ai-component';
import { StateMachineComponent } from '../components/state-machine-component';
import { DirectionComponent } from '../components/direction-component';
import { HealthComponent } from '../components/health-component';

export class AISystem extends ex.System {
    systemType = ex.SystemType.Update;
    public query!: ex.Query<
        typeof AIComponent |
        typeof StateMachineComponent |
        typeof DirectionComponent |
        typeof HealthComponent |
        typeof ex.TransformComponent
    >;

    private playerQuery!: ex.Query<typeof ex.TransformComponent>;

    initialize(world: ex.World, scene: ex.Scene): void {
        console.log("AISystem");
        this.query = world.query([
            AIComponent,
            StateMachineComponent,
            DirectionComponent,
            HealthComponent,
            ex.TransformComponent
        ]);
        // 查询玩家实体
        this.playerQuery = world.query([ex.TransformComponent]);
    }

    update(elapsed: number): void {
        const playerEntities = this.playerQuery.entities.filter(e => e.hasTag('player'));
        if (playerEntities.length === 0) return;
        const player = playerEntities[0] as ex.Actor;

        for (const entity of this.query.entities) {
            const ai = entity.get(AIComponent);
            const stateComp = entity.get(StateMachineComponent);
            const directionComp = entity.get(DirectionComponent);
            const healthComp = entity.get(HealthComponent);
            const transform = entity.get(ex.TransformComponent);

            if (!stateComp.fsm) continue;

            // 尊重眩晕期间不执行 AI
            if (healthComp.stunUntil && Date.now() < healthComp.stunUntil) {
                try { stateComp.fsm.go('Idle'); } catch (e) { /* ignore */ }
                continue;
            }

            const toPlayer = player.pos.clone().sub(transform.pos);
            const dist = toPlayer.distance();
            const deltaSeconds = elapsed / 1000;

            if (dist <= ai.chaseRadius) {
                const dir = toPlayer.normalize();
                transform.pos.x += dir.x * ai.speed * deltaSeconds;
                transform.pos.y += dir.y * ai.speed * deltaSeconds;

                // 仅使用四方向之一以匹配现有贴图行
                const absX = Math.abs(dir.x);
                const absY = Math.abs(dir.y);
                if (absX > absY) {
                    directionComp.direction = dir.x > 0 ? ex.Vector.Right : ex.Vector.Left;
                } else {
                    directionComp.direction = dir.y > 0 ? ex.Vector.Down : ex.Vector.Up;
                }

                // 切换到 Walk 状态
                try { stateComp.fsm.go('Walk'); } catch (e) { /* ignore */ }
            } else {
                // 切换到 Idle 状态
                try { stateComp.fsm.go('Idle'); } catch (e) { /* ignore */ }
            }
        }
    }
}