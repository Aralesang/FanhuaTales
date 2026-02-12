import { Component, Actor, GraphicsComponent } from 'excalibur';

/** 简单生命组件：管理血量并提供受击接口（击杀时会调用 actor.kill()） */
export class HealthComponent extends Component {
  public hp: number;
  public maxHp: number;

  constructor(hp: number) {
    super();
    this.hp = hp;
    this.maxHp = hp;
  }

  /**
   * amount: 伤害值
   * opts.source: 伤害来源（Actor 或 Vector），用于计算击退方向
   * opts.knockback: 击退速度（像素/秒）
   * opts.stunMs: 被击晕的毫秒数（在此期间 AI 不工作）
   * opts.flashMs / flashTimes: 受击时闪烁效果
   */
  public takeDamage(amount: number, opts?: { source?: Actor | { x: number; y: number } | undefined, knockback?: number, stunMs?: number, flashMs?: number, flashTimes?: number }) {
    this.hp -= amount;

    const owner = this.owner as Actor | undefined;

    // 视觉反馈：闪烁（通过 GraphicsComponent.opacity）
    if (owner && opts?.flashMs) {
      const flashTimes = opts.flashTimes ?? 3;
      const flashMs = opts.flashMs ?? 300;
      const interval = Math.max(20, Math.floor(flashMs / (flashTimes * 2)));
      let flashes = 0;
      const gfx = owner.get(GraphicsComponent) as GraphicsComponent | undefined;
      const originalOpacity = gfx?.opacity ?? 1;
      const iv = globalThis.setInterval(() => {
        if (gfx) {
          gfx.opacity = gfx.opacity === originalOpacity ? 0.25 : originalOpacity;
        }
        flashes++;
        if (flashes >= flashTimes * 2) {
          if (gfx) gfx.opacity = originalOpacity;
          globalThis.clearInterval(iv);
        }
      }, interval);
      // 保险的清理
      globalThis.setTimeout(() => {
        try { if (gfx) gfx.opacity = originalOpacity; } catch (e) { /* ignore */ }
        globalThis.clearInterval(iv);
      }, flashMs + 50);
    }

    // 击退 + 眩晕
    if (owner && opts?.source && opts.knockback && opts.stunMs && opts.knockback > 0 && opts.stunMs > 0) {
      let srcPos: { x: number; y: number };
      if ((opts.source as Actor).pos) {
        const s = opts.source as Actor;
        srcPos = { x: s.pos.x, y: s.pos.y };
      } else {
        srcPos = opts.source as any;
      }
      const dirX = owner.pos.x - srcPos.x;
      const dirY = owner.pos.y - srcPos.y;
      const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const nx = dirX / len;
      const ny = dirY / len;
      // 直接设置速度实现击退（短时间内由物理/帧位移体现）
      try {
        owner.vel = owner.vel ?? ({} as any);
        owner.vel.x = nx * opts.knockback;
        owner.vel.y = ny * opts.knockback;
      } catch (e) {
        // 如果 Actor 不支持 vel，尝试直接移动一次性位移
        owner.pos.x += nx * (opts.knockback * 0.016);
        owner.pos.y += ny * (opts.knockback * 0.016);
      }

      const until = Date.now() + opts.stunMs;
      try {
        (owner as any).__stunUntil = until;
      } catch (e) { /* ignore */ }

      // 停止击退效果
      globalThis.setTimeout(() => {
        try {
          // 仅在未再次被设置更远的眩晕时清除
          if ((owner as any).__stunUntil && Date.now() >= (owner as any).__stunUntil) {
            (owner as any).__stunUntil = undefined;
          }
          if (owner.vel) {
            owner.vel.x = 0;
            owner.vel.y = 0;
          }
        } catch (e) { /* ignore */ }
      }, opts.stunMs + 10);
    }

    if (this.hp <= 0) {
      if (owner) {
        owner.kill();
      }
    }
  }

  public isDead() {
    return this.hp <= 0;
  }
}
