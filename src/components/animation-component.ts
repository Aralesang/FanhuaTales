import { Component, Actor, Vector, SpriteSheet, range, Animation, AnimationStrategy, Color } from 'excalibur';
import { Asset } from '../asset';

/**
 * 动画组件 —— 管理实体的精灵动画状态
 * 
 * 存储当前实体的动画信息，包括实体类型、当前播放的动画、方向等。
 * 与 AnimationSystem 配合使用，系统根据该组件的数据来切换和播放动画。
 * 动画名称通过 "{entityType}_{animType}" 格式拼接，对应 Asset 中加载的图片资源。
 */
export class AnimationComponent extends Component {
    /** 实体类型（如 'human'），用于拼接动画资源名称 */
    public entityType: string;
    /** 关联的 Actor 实体，用于设置图形显示 */
    public actor: Actor;
    /** 动画缓存映射，键为动画全称（如 "human_idle_down"），值为对应的 Animation 实例 */
    public animationMap: Map<string, Animation> = new Map();
    /** 当前正在播放的动画名称 */
    public currentAnimationName: string = "";
    /** 当前动画实例 */
    public animation: Animation | undefined;
    /** 当前动画的方向向量（上/下/左/右） */
    public currentDirection: Vector = Vector.Down;
    /** 动画类型（如 'idle'、'walk'、'run'、'sword'），由状态机或技能系统设置 */
    public animType: string = "idle";
    /** 当前已应用的动画类型，用于检测动画是否需要切换 */
    public currentAnimType: string = "idle";
    /** 动画色调（可选），用于区分敌人和玩家等不同实体 */
    public tint: Color | undefined;
    /** 是否已完成初始化，防止重复初始化动画 */
    public initialized: boolean = false;

    /**
     * @param entityType - 实体类型名称（如 'human'）
     * @param actor - 关联的 Actor
     * @param tint - 可选的颜色色调，用于给动画着色
     */
    constructor(entityType: string, actor: Actor, tint?: Color) {
        super();
        this.entityType = entityType;
        this.actor = actor;
        this.tint = tint;
    }
   
}