import { Actor, Trigger, CollisionType, Shape, Vector } from "excalibur";
import { Skill } from "./skill";
import { AnimationComponent } from "../components/animation-component";
import { DirectionComponent } from "../components/direction-component";
import { HealthComponent } from "../components/health-component";
import { Asset } from "../asset";
import { Village } from "../scenes/village";
import { DamageSystem } from "../systems/damage-system";
import { AnimationEvents } from "../events/animation-event";
import { EquipmentComponent } from "../components/equipment-component";

export class SwordSkill implements Skill {
    name = "Sword";
    cooldown = 500;
    currentCooldown = 0;
    animationType = "sword";
    soundName = "human_atk_sword_1";

    async execute(actor: Actor): Promise<void> {
        return new Promise((resolve) => {
            const animationComponent = actor.get(AnimationComponent);
            const direction = actor.get(DirectionComponent).direction;
            const scene = actor.scene!;
            animationComponent.animType = this.animationType;
            if (this.soundName) {
                Asset.playSound(this.soundName);
            }
            let equipmentAttack = 0;
            const equipComp = actor.get(EquipmentComponent);
            if (equipComp) {
                equipmentAttack = equipComp.getTotalAttack();
            }
            const baseDamage = 1;
            const totalDamage = baseDamage + equipmentAttack;

            const hitWindowStart = 120;
            const hitWindowDuration = 100;
            const hitWidth = 16;
            const hitHeight = 16;
            const offset = 12;
            let enabled = false;
            const alreadyHit = new Set<Actor>();
            const attackPos = actor.pos.clone().add(direction.normalize().scale(offset));

            const attackTrigger = new Trigger({
                pos: attackPos,
                width: hitWidth,
                height: hitHeight,
                collisionType: CollisionType.Passive,
                filter: (other) => {
                    if (!enabled) return false;
                    if (actor.tags.has("player")) return other.tags.has("enemy");
                    if (actor.tags.has("enemy")) return other.tags.has("player");
                    return false;
                },
                action: (other) => {
                    if (!(other instanceof Actor)) return;
                    if (alreadyHit.has(other)) return;
                    alreadyHit.add(other);
                    const damageSystem = (scene as Village).damageSystem;
                    if (damageSystem) {
                        damageSystem.applyDamage(other, totalDamage, {
                            source: actor,
                            knockback: 140,
                            stunMs: 220,
                            flashMs: 300,
                            flashTimes: 3
                        });
                        console.log("[Attack] hit:", other, "damage:", totalDamage, "hp->", other.get(HealthComponent).hp);
                    }
                }
            });
            attackTrigger.collider.set(Shape.Box(hitWidth, hitHeight));
            scene.add(attackTrigger);

            const postUpdateHandler = () => {
                if (enabled && !attackTrigger.isKilled()) {
                    attackTrigger.pos = actor.pos.clone().add(direction.normalize().scale(offset));
                }
            };
            scene.on("postupdate", postUpdateHandler);

            const performImmediateOverlapCheck = () => {
                const rectLeft = attackTrigger.pos.x - attackTrigger.width / 2;
                const rectTop = attackTrigger.pos.y - attackTrigger.height / 2;
                const rectRight = rectLeft + attackTrigger.width;
                const rectBottom = rectTop + attackTrigger.height;
                const entities = (scene.world as any).entities as Set<any> | undefined;
                if (!entities) return;
                for (const ent of Array.from(entities)) {
                    if (!ent || ent === actor) continue;
                    try {
                        const other = ent as Actor;
                        if (!other.tags.has("player") && !other.tags.has("enemy")) continue;
                        const ax = other.pos.x;
                        const ay = other.pos.y;
                        const aw = other.width || 0;
                        const ah = other.height || 0;
                        const aLeft = ax - (other.anchor?.x ?? 0.5) * aw;
                        const aTop = ay - (other.anchor?.y ?? 0.5) * ah;
                        const aRight = aLeft + aw;
                        const aBottom = aTop + ah;
                        const intersect = !(aRight < rectLeft || aLeft > rectRight || aBottom < rectTop || aTop > rectBottom);
                        if (intersect && !alreadyHit.has(other)) {
                            alreadyHit.add(other);
                            const damageSystem = (scene as Village).damageSystem;
                            if (damageSystem) {
                                damageSystem.applyDamage(other, totalDamage, {
                                    source: actor,
                                    knockback: 140,
                                    stunMs: 220,
                                    flashMs: 300,
                                    flashTimes: 3
                                });
                                console.log("[Attack] immediate-overlap hit:", other, "damage:", totalDamage, "hp->", other.get(HealthComponent).hp);
                            }
                        }
                    } catch (err) {
                        // ignore
                    }
                }
            };

            const t1 = globalThis.setTimeout(() => {
                enabled = true;
                attackTrigger.pos = actor.pos.clone().add(direction.normalize().scale(offset));
                performImmediateOverlapCheck();
            }, hitWindowStart);

            const t2 = globalThis.setTimeout(() => {
                enabled = false;
                if (!attackTrigger.isKilled()) {
                    scene.remove(attackTrigger);
                }
                scene.off("postupdate", postUpdateHandler);
            }, hitWindowStart + hitWindowDuration);

            const completeHandler = (animComp: AnimationComponent | unknown) => {
                if (!(animComp instanceof AnimationComponent) || animComp.animType !== this.animationType) return;
                globalThis.clearTimeout(t1);
                globalThis.clearTimeout(t2);
                if (!attackTrigger.isKilled()) {
                    scene.remove(attackTrigger);
                }
                scene.off("postupdate", postUpdateHandler);
                actor.events.off(AnimationEvents.AnimationComplete, completeHandler);
                resolve();
            };
            actor.events.on(AnimationEvents.AnimationComplete, completeHandler);
        });
    }
}
