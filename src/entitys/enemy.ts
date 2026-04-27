import * as ex from 'excalibur';
import { StateMachineComponent } from '../components/state-machine-component';
import { AnimationComponent } from '../components/animation-component';
import { DirectionComponent } from '../components/direction-component';
import { HealthComponent } from '../components/health-component';
import { AIComponent } from '../components/ai-component';
import { InventoryComponent } from '../components/inventory-component';
import { ItemUseRequestComponent } from '../components/item-use-request-component';
import { SkillComponent } from '../components/skill-component';
import { SwordSkill } from '../skills/sword-skill';
import { HealthBar } from '../ui/health-bar-ui';
import { LootDropComponent } from '../components/loot-drop-component';

/**
 * 敌人创建选项
 * 支持从 Tiled 地图对象属性中读取配置，实现数据驱动的敌人创建
 */
export type EnemyOptions = {
    /** 敌人显示名称 */
    name?: string;
    /** 最大生命值 */
    hp?: number;
    /** AI 追击距离（像素） */
    aiChaseDistance?: number;
    /** AI 攻击距离（像素） */
    aiAttackDistance?: number;
    /** AI 攻击冷却（毫秒） */
    aiAttackCooldown?: number;
    /** 动画类型标识（如 'human'） */
    animationType?: string;
    /** 着色色调 */
    tint?: ex.Color;
    /** 掉落表 key（对应 drops-map.json），不指定则使用 default_enemy */
    dropTableKey?: string;
    /** 掉落散布半径（像素），不指定则默认 12 */
    dropScatterRadius?: number;
};

/** 敌人实体 */
export class Enemy extends ex.Actor {
    private readonly options: EnemyOptions;

    constructor(pos: ex.Vector, options?: EnemyOptions) {
        super({
            pos: pos,
            width: 10,
            height: 8,
            anchor: new ex.Vector(0.5, 0.55),
            z: 4,
            name: options?.name ?? 'Enemy'
        });
        this.options = options ?? {};
    }

    onInitialize(_engine: ex.Engine): void {
        // 方向组件：初始面向下方
        this.addComponent(new DirectionComponent(ex.Vector.Down));
        // 状态机组件：管理 idle/walk/attack/hurt/dead 等状态
        this.addComponent(new StateMachineComponent());
        // 动画组件：根据状态和方向播放对应动画
        this.addComponent(new AnimationComponent(
            this.options.animationType ?? 'human',
            this,
            this.options.tint ?? ex.Color.Red
        ));

        // 生命值组件：支持从 Tiled 配置自定义血量，默认 3 点
        const healthComp = new HealthComponent(this.options.hp ?? 3);
        this.addComponent(healthComp);
        this.addChild(new HealthBar(healthComp));

        // AI 组件：支持从 Tiled 配置自定义行为参数
        this.addComponent(new AIComponent(
            this.options.aiChaseDistance ?? 30,
            this.options.aiAttackDistance ?? 60,
            this.options.aiAttackCooldown ?? 1000
        ));

        // 敌人技能组件（默认剑击）
        const skillComponent = new SkillComponent();
        skillComponent.addSkill(new SwordSkill());
        this.addComponent(skillComponent);

        // 添加库存和物品使用组件（让 NPC 也能使用道具）
        this.addComponent(new InventoryComponent());
        this.addComponent(new ItemUseRequestComponent());

        // 添加掉落组件：支持从 Tiled 配置指定掉落表 key 和散布半径
        this.addComponent(new LootDropComponent(
            this.options.dropTableKey ?? 'default_enemy',
            this.options.dropScatterRadius ?? 12
        ));

        this.body.collisionType = ex.CollisionType.Active;
        this.addTag('enemy');
    }
}
