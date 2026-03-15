import { Component, Actor, Vector, SpriteSheet, range, Animation, AnimationStrategy, Color } from 'excalibur';
import { Asset } from '../asset';

export class AnimationComponent extends Component {
    public entityType: string;
    public actor: Actor;
    /** 当前已经生成的动画 */
    public animationMap: Map<string, Animation> = new Map();
    /** 当前动画 */
    public currentAnimationName: string = "";
    public animation: Animation | undefined;
    /** 当前动画方向 */
    public currentDirection: Vector = Vector.Down;
    /** 动画类型 */
    public animType: string = "idle";
    /** 当前动画类型 */
    public currentAnimType: string = "idle";
    /** 动画色调 */
    public tint: Color | undefined;
    /** 是否初始化完成 */
    public initialized: boolean = false;

    constructor(entityType: string, actor: Actor, tint?: Color) {
        super();
        this.entityType = entityType;
        this.actor = actor;
        this.tint = tint;
    }
   
}