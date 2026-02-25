import { Actor, Entity, State, Trigger, CollisionType, Shape, Vector } from "excalibur";
import { AnimationComponent } from "../components/animation-component";
import { StateMachineComponent } from "../components/state-machine-component";
import { DirectionComponent } from "../components/direction-component";
import { HealthComponent } from "../components/health-component";
import { Asset } from "../asset";

export const SwordState: State<Actor> = {
    name: "Sword",
    transitions: ["Idle"],
    onEnter(context: { from: string; eventData?: any; data: Actor; }) {
        const { data } = context;
        //console.log(context.data, "进入Sword状态");
        const animationComponent = data.get(AnimationComponent);
        const direction = data.get(DirectionComponent).direction;
        const stateMachine = data.get(StateMachineComponent).fsm;
        animationComponent.changeAnimation(data, "sword", direction);
        const animation = animationComponent.getCurrentAnimation();

        // 攻击判定：使用短时触发器 + 立即重叠检测以保证可靠命中
        const scene = data.scene!;
        const hitWindowStart = 120; // ms（相对于动画开始）
        const hitWindowDuration = 100; // ms
        const hitWidth = 16;
        const hitHeight = 16;
        const offset = 12; // 相对于角色中心的偏移
        let enabled = false;
        const alreadyHit = new Set<Entity<any>>();

        //发出音效
        Asset.playSound("human_atk_sword_1");

        const attackPos = data.pos.clone().add(direction.normalize().scale(offset));
        const attackTrigger = new Trigger({
            pos: attackPos,
            width: hitWidth,
            height: hitHeight,
            collisionType: CollisionType.Passive,
            filter: (actor) => {
                if (!enabled) return false;
                // 玩家挥刀只命中带有 enemy 标签的实体；敌人挥刀可命中玩家（后续可扩展）
                if (data.tags.has('player')) return actor.tags.has('enemy');
                if (data.tags.has('enemy')) return actor.tags.has('player');
                return false;
            },
            action: (other) => {
                // 运行时日志便于调试（如需删掉可移除）
                console.log('[Attack] trigger.action ->', other?.tags?.toString?.());
                if (alreadyHit.has(other)) return;
                alreadyHit.add(other);
                const hc = (other as Actor).get(HealthComponent);
                if (hc) {
                    hc.takeDamage(1, { source: data, knockback: 140, stunMs: 220, flashMs: 300, flashTimes: 3 });
                    console.log('[Attack] hit:', other, 'hp->', hc.hp);
                }
            }
        });
        attackTrigger.collider.set(Shape.Box(hitWidth, hitHeight));
        scene.add(attackTrigger);

        // 持续在帧更新时把触发器跟随到 actor 前方（保证移动中也能命中）
        const postUpdateHandler = () => {
            if (enabled && !attackTrigger.isKilled()) {
                attackTrigger.pos = data.pos.clone().add(direction.normalize().scale(offset));
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
            if (!entities) return;
            for (const ent of Array.from(entities)) {
                if (!ent || ent === data) continue;
                try {
                    const actor = ent as Actor;
                    // 只检查带有可能被命中的 tag 的实体
                    if (data.tags.has('player') && !actor.tags.has('enemy')) continue;
                    if (data.tags.has('enemy') && !actor.tags.has('player')) continue;

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
                        const hc = actor.get(HealthComponent);
                        if (hc) {
                            hc.takeDamage(1, { source: data, knockback: 140, stunMs: 220, flashMs: 300, flashTimes: 3 });
                            console.log('[Attack] immediate-overlap hit:', actor, 'hp->', hc.hp);
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
            attackTrigger.pos = data.pos.clone().add(direction.normalize().scale(offset));
            performImmediateOverlapCheck();
        }, hitWindowStart);

        const t2 = globalThis.setTimeout(() => {
            enabled = false;
            if (!attackTrigger.isKilled()) {
                scene.remove(attackTrigger);
            }
            scene.off('postupdate', postUpdateHandler);
        }, hitWindowStart + hitWindowDuration);

        animation?.events.once('end', () => {
            // 清理定时器与触发器
            globalThis.clearTimeout(t1);
            globalThis.clearTimeout(t2);
            if (!attackTrigger.isKilled()) {
                scene.remove(attackTrigger);
            }
            scene.off('postupdate', postUpdateHandler);
            //console.log("攻击结束");
            stateMachine?.go("Idle");
        });
    }
}