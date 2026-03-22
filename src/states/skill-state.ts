import { Actor, State } from "excalibur";
import { AnimationComponent } from "../components/animation-component";
import { SkillComponent } from "../components/skill-component";
import { StateMachineComponent } from "../components/state-machine-component";

/**
 * 通用技能状态
 * 处理所有技能的执行和状态转换
 */
export const SkillState: State<Actor> = {
    name: "Skill",
    transitions: ["Idle"],
    onEnter(context: { from: string; eventData?: any; data: Actor; }) {
        const { data: actor } = context;
        const skillComponent = actor.get(SkillComponent);
        const animationComponent = actor.get(AnimationComponent);

        if (skillComponent.currentSkill) {
            // 设置动画
            animationComponent.animType = skillComponent.currentSkill.animationType;

            // 执行技能
            skillComponent.currentSkill.execute(actor).then(() => {
                // 技能执行完成后，返回Idle状态
                const stateMachine = actor.get(StateMachineComponent).fsm;
                if (stateMachine) {
                    stateMachine.go("Idle");
                }
            }).catch((error) => {
                console.error("技能执行失败:", error);
                // 出错时也返回Idle
                const stateMachine = actor.get(StateMachineComponent).fsm;
                if (stateMachine) {
                    stateMachine.go("Idle");
                }
            });
        } else {
            // 如果没有当前技能，直接返回Idle
            const stateMachine = actor.get(StateMachineComponent).fsm;
            if (stateMachine) {
                stateMachine.go("Idle");
            }
        }
    }
};