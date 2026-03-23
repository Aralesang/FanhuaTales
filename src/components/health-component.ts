import { Component } from 'excalibur';

/**
 * 生命值组件 —— 管理实体的血量数据
 * 
 * 纯数据组件，存储当前血量、最大血量和眩晕状态。
 * 由 DamageSystem 负责处理伤害逻辑和死亡判定。
 * 别的系统（如 AISystem）会检查 stunUntil 来判断是否处于眩晕状态。
 */
export class HealthComponent extends Component {
  /** 当前血量 */
  public hp: number;
  /** 最大血量 */
  public maxHp: number;
  /** 眩晕结束时间戳（Date.now() 毫秒），未定义表示未眩晕 */
  public stunUntil?: number;

  /**
   * @param hp - 初始血量，同时作为最大血量
   */
  constructor(hp: number) {
    super();
    this.hp = hp;
    this.maxHp = hp;
  }

  /** 判断实体是否已死亡 */
  public isDead() {
    return this.hp <= 0;
  }
}
