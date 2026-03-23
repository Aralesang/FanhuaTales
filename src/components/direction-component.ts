import * as ex from 'excalibur';

/**
 * 方向组件 —— 存储实体当前朝向
 * 
 * 记录实体面向的方向向量（上/下/左/右）。
 * 被动画系统用于确定播放哪一行精灵图动画，
 * 也被技能系统用于确定攻击判定区域的位置。
 */
export class DirectionComponent extends ex.Component {
    /** 内部方向向量，通过 getter/setter 访问 */
    private _direction: ex.Vector;

    /**
     * @param direction - 初始方向向量，建议使用 ex.Vector.Up/Down/Left/Right
     */
    constructor(direction: ex.Vector) {
        super();
        this._direction = direction;
    }

    /** 设置当前方向 */
    public set direction(direction: ex.Vector) {
        this._direction = direction;
    }

    /** 获取当前方向 */
    public get direction(){
        return this._direction;
    }
}