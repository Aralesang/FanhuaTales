import { Component } from 'excalibur';

/** 简单生命组件：纯数据，管理血量 */
export class HealthComponent extends Component {
  public hp: number;
  public maxHp: number;
  public stunUntil?: number; // 眩晕结束时间戳

  constructor(hp: number) {
    super();
    this.hp = hp;
    this.maxHp = hp;
  }

  public isDead() {
    return this.hp <= 0;
  }
}
