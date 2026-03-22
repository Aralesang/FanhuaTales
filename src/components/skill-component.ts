import { Component } from "excalibur";
import { Skill } from "../skills/skill";

/**
 * 技能组件
 * 存储角色的技能列表和当前状态
 */
export class SkillComponent extends Component {
    /** 技能映射表 */
    public skills: Map<string, Skill> = new Map();
    /** 当前激活的技能 */
    public currentSkill: Skill | null = null;

    constructor() {
        super();
    }

    /**
     * 添加技能
     * @param skill 技能实例
     */
    addSkill(skill: Skill): void {
        this.skills.set(skill.name, skill);
    }

    /**
     * 获取技能
     * @param name 技能名称
     * @returns 技能实例或undefined
     */
    getSkill(name: string): Skill | undefined {
        return this.skills.get(name);
    }

    /**
     * 检查技能是否可用（非冷却中）
     * @param name 技能名称
     * @returns 是否可用
     */
    isSkillReady(name: string): boolean {
        const skill = this.getSkill(name);
        return skill ? skill.currentCooldown <= 0 : false;
    }

    /**
     * 设置当前技能
     * @param skill 技能实例
     */
    setCurrentSkill(skill: Skill): void {
        this.currentSkill = skill;
    }
}