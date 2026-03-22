import * as ex from 'excalibur';
import { AIComponent } from '../components/ai-component';
import { StateMachineComponent } from '../components/state-machine-component';
import { DirectionComponent } from '../components/direction-component';
import { HealthComponent } from '../components/health-component';
import { SkillComponent } from '../components/skill-component';

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

            const skillComponent = entity.get(SkillComponent);
            const attackRange = 20; // 近战触发距离
            const canAttack = Date.now() - ai.lastAttackTime >= ai.attackCooldown;

            if (dist <= attackRange && skillComponent && canAttack && skillComponent.isSkillReady("Sword")) {
                // 进入Skill状态并执行当前技能（当前只支持SwordSkill）
                const swordSkill = skillComponent.getSkill("Sword");
                if (swordSkill) {
                    skillComponent.setCurrentSkill(swordSkill);
                    try { stateComp.fsm.go('Skill'); } catch (e) { /* ignore */ }
                    ai.lastAttackTime = Date.now();
                    swordSkill.currentCooldown = swordSkill.cooldown;
                    // 进入攻击后不再移动
                    continue;
                }
            }

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