import * as ex from "excalibur";
import { SkillComponent } from "../components/skill-component";

/**
 * 技能系统
 * 负责管理技能的冷却和更新
 */
export class SkillSystem extends ex.System {
    systemType: ex.SystemType = ex.SystemType.Update;
    public query!: ex.Query<typeof SkillComponent>;

    initialize(world: ex.World, scene: ex.Scene): void {
        console.log("SkillSystem initialized");
        this.query = world.query([SkillComponent]);
    }

    update(delta: number): void {
        // 更新所有技能的冷却时间
        for (const entity of this.query.entities) {
            const skillComponent = entity.get(SkillComponent);
            for (const skill of skillComponent.skills.values()) {
                if (skill.currentCooldown > 0) {
                    skill.currentCooldown = Math.max(0, skill.currentCooldown - delta);
                }
            }
        }
    }
}