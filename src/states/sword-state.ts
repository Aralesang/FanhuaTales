import { Actor, Entity, State, Trigger, CollisionType, Shape, Vector, AnimationStrategy } from "excalibur";
import { AnimationComponent } from "../components/animation-component";
import { StateMachineComponent } from "../components/state-machine-component";
import { DirectionComponent } from "../components/direction-component";
import { HealthComponent } from "../components/health-component";
import { Asset } from "../asset";
import { Village } from "../scenes/village";
import { DamageSystem } from "../systems/damage-system";
import { AnimationEvents } from "../events/animation-event";

export const SwordState: State<Actor> = {
    name: "Sword",
    transitions: ["Idle"],
    onEnter(context: { from: string; eventData?: any; data: Actor; }) {
        const { data: actor } = context;
        //console.log(context.data, "进入Sword状态");
        const animationComponent = actor.get(AnimationComponent);
        const direction = actor.get(DirectionComponent).direction;
        const stateMachine = actor.get(StateMachineComponent).fsm;
        animationComponent.animType = "sword";
        
        // 攻击判定：使用短时触发器 + 立即重叠检测以保证可靠命中
        const scene = actor.scene!;
        const hitWindowStart = 120; // ms（相对于动画开始）
        const hitWindowDuration = 100; // ms
        const hitWidth = 16;
        const hitHeight = 16;
        const offset = 12; // 相对于角色中心的偏移
        let enabled = false;
        const alreadyHit = new Set<Entity<any>>();

        //发出音效
        Asset.playSound("human_atk_sword_1");

        const attackPos = actor.pos.clone().add(direction.normalize().scale(offset));
        const attackTrigger = new Trigger({
            pos: attackPos,
            width: hitWidth,
            height: hitHeight,
            collisionType: CollisionType.Passive,
            filter: (actor) => {
                if (!enabled) return false;
                // 玩家挥刀只命中带有 enemy 标签的实体；敌人挥刀可命中玩家（后续可扩展）
                if (actor.tags.has('player')) return actor.tags.has('enemy');
                if (actor.tags.has('enemy')) return actor.tags.has('player');
                return false;
            },
            action: (other) => {
                // 运行时日志便于调试（如需删掉可移除）
                console.log('[Attack] trigger.action ->', other?.tags?.toString?.());
                if (alreadyHit.has(other)) return;
                alreadyHit.add(other);
                const damageSystem = (scene as Village).damageSystem;
                if (damageSystem) {
                    damageSystem.applyDamage(other, 1, { source: actor, knockback: 140, stunMs: 220, flashMs: 300, flashTimes: 3 });
                    console.log('[Attack] hit:', other, 'hp->', (other as Actor).get(HealthComponent).hp);
                }
            }
        });
        attackTrigger.collider.set(Shape.Box(hitWidth, hitHeight));
        scene.add(attackTrigger);

        // 持续在帧更新时把触发器跟随到 actor 前方（保证移动中也能命中）
        const postUpdateHandler = () => {
            if (enabled && !attackTrigger.isKilled()) {
                attackTrigger.pos = actor.pos.clone().add(direction.normalize().scale(offset));
            }
        };
        scene.on('postupdate', postUpdateHandler);

        // 立即检测一次场景中已在判定框内的目标（补偿触发器过滤/引擎漏判）
        const performImmediateOverlapCheck = () => {
            const rectLeft = attackTrigger.pos.x - attackTrigger.width / 2;
            const rectTop = attackTrigger.pos.y - attackTrigger.height / 2;
            const rectRight = rectLeft + attackTrigger.width;
            const rectBottom = rectTop + attackTrigger.height;

            // 遍历 world.entities（防御性写法以避免类型报错）
            const entities = (scene.world as any).entities as Set<any> | undefined;
            console.log("entities:",entities);
            
            if (!entities) return;
            for (const ent of Array.from(entities)) {
                if (!ent || ent === actor) continue;
                try {
                    const actor = ent as Actor;
                    // 只检查带有可能被命中的 tag 的实体
                    if (!actor.tags.has('player') && !actor.tags.has('enemy')) continue;
                    console.log(actor.name);
                    
                    const ax = actor.pos.x;
                    const ay = actor.pos.y;
                    const aw = actor.width || 0;
                    const ah = actor.height || 0;
                    const aLeft = ax - (actor.anchor?.x ?? 0.5) * aw;
                    const aTop = ay - (actor.anchor?.y ?? 0.5) * ah;
                    const aRight = aLeft + aw;
                    const aBottom = aTop + ah;

                    const intersect = !(aRight < rectLeft || aLeft > rectRight || aBottom < rectTop || aTop > rectBottom);
                    if (intersect && !alreadyHit.has(actor)) {
                        alreadyHit.add(actor);
                        const damageSystem = (scene as Village).damageSystem;
                        if (damageSystem) {
                            damageSystem.applyDamage(actor, 1, { source: actor, knockback: 140, stunMs: 220, flashMs: 300, flashTimes: 3 });
                            console.log('[Attack] immediate-overlap hit:', actor, 'hp->', actor.get(HealthComponent).hp);
                        }
                    }
                } catch (err) {
                    // 忽略不可用的实体
                }
            }
        };

        // 在短窗内开启判定，然后清理
        const t1 = globalThis.setTimeout(() => {
            enabled = true;
            // 立即执行一次重叠检测，确保已经在范围内的实体被命中
            attackTrigger.pos = actor.pos.clone().add(direction.normalize().scale(offset));
            performImmediateOverlapCheck();
        }, hitWindowStart);

        const t2 = globalThis.setTimeout(() => {
            enabled = false;
            if (!attackTrigger.isKilled()) {
                scene.remove(attackTrigger);
            }
            scene.off('postupdate', postUpdateHandler);
        }, hitWindowStart + hitWindowDuration);
        actor?.events.on(AnimationEvents.AnimationComplete, (animation: AnimationComponent | unknown) => {
            if(!animation || !(animation instanceof AnimationComponent) || animation.animType !== "sword"){
                return;
            }
            // 清理定时器与触发器
            globalThis.clearTimeout(t1);
            globalThis.clearTimeout(t2);
            if (!attackTrigger.isKilled()) {
                scene.remove(attackTrigger);
            }
            scene.off('postupdate', postUpdateHandler);
            stateMachine?.go("Idle");
        });
    }
}