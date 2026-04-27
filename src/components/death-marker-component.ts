import * as ex from 'excalibur';

/**
 * 死亡标记组件 —— 由 DamageSystem 在检测到实体死亡时附加，用于与 LootDropSystem 协作处理掉落逻辑。
 *
 * ECS 设计说明：
 * - DamageSystem 负责判定死亡（hp <= 0），但不直接执行 kill()，而是附加此组件；
 * - LootDropSystem 查询带有此组件的实体，执行掉落逻辑后设置 processed = true；
 * - DamageSystem 下一帧发现 processed = true，执行 entity.kill() 完成清理。
 *
 * 这种数据驱动的协作方式避免了 System 之间直接互相调用，保持了 ECS 分层解耦。
 */
export class DeathMarkerComponent extends ex.Component {
    /** 组件类型标识 */
    public readonly type = 'death_marker';

    /**
     * 掉落是否已由 LootDropSystem 处理完毕。
     * false 表示待处理；true 表示掉落已完成，可以安全移除实体。
     */
    public processed: boolean = false;

    /**
     * 死亡时间戳，用于调试或延迟处理。
     */
    public deathTime: number;

    constructor() {
        super();
        this.deathTime = Date.now();
    }
}
