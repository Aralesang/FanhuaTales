import * as ex from 'excalibur';

/**
 * 单个掉落项配置接口
 * 用于 drops-map.json 中定义每种敌人可能掉落的物品
 */
export interface DropEntryConfig {
    /** 物品类型 ID（对应 items-map.json 中的 key） */
    itemId: string;
    /** 掉落概率，范围 0.0 ~ 1.0 */
    chance: number;
    /** 单次掉落的最小数量 */
    minQuantity: number;
    /** 单次掉落的最大数量 */
    maxQuantity: number;
}

/**
 * 敌人掉落表配置接口
 * 对应 drops-map.json 中每个敌人的完整掉落配置
 */
export interface LootDropTableConfig {
    /** 掉落表描述（仅用于策划阅读） */
    description?: string;
    /** 可掉落的物品列表 */
    drops: DropEntryConfig[];
}

/**
 * 掉落组件 —— 标记一个实体（敌人）拥有战利品掉落能力
 *
 * 该组件存储敌人的掉落表 key，由 LootDropSystem 在敌人死亡时读取配置并执行掉落逻辑。
 * 组件本身不存储具体的掉落计算结果，仅作为数据标记供 System 查询。
 */
export class LootDropComponent extends ex.Component {
    /** 组件类型标识 */
    public readonly type = 'loot_drop';

    /**
     * 掉落表 key，对应 drops-map.json 中的顶层 key。
     * 例如 'goblin'、'orc'、'default_enemy' 等。
     * 如果指定的 key 在配置中不存在，将回退到 'default_enemy'。
     */
    public dropTableKey: string;

    /**
     * 掉落偏移半径（像素）。
     * 生成的物品会在敌人死亡位置周围以此半径随机散布，避免物品重叠。
     */
    public scatterRadius: number;

    /**
     * @param dropTableKey - 掉落表配置 key，默认为 'default_enemy'
     * @param scatterRadius - 掉落散布半径（像素），默认为 12
     */
    constructor(dropTableKey: string = 'default_enemy', scatterRadius: number = 12) {
        super();
        this.dropTableKey = dropTableKey;
        this.scatterRadius = scatterRadius;
    }
}
