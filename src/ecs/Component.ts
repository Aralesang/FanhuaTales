import { Types, Input, GameObjects } from 'phaser';
import { Entity } from './Entity';

export interface Component {
    readonly type: string;
}

/** 精灵组件：持有 Phaser Sprite 实例，提供渲染能力 */
export class SpriteComponent implements Component {
    readonly type = 'sprite';
    sprite: GameObjects.Sprite;

    constructor(sprite: GameObjects.Sprite) {
        this.sprite = sprite;
    }
}

/** 视觉大小组件：描述角色实际视觉尺寸，用于距离/范围计算 */
export class VisualComponent implements Component {
    readonly type = 'visual';
    width: number = 10;
    height: number = 10;
}

/**
 * 物理碰撞体配置组件：描述 body 相对 sprite 左上角的尺寸与偏移。
 * 由 Entity.applyBodyConfig() 创建并立即写入到 Phaser body 上。
 */
export class BodyConfigComponent implements Component {
    readonly type = 'body_config';
    width: number;
    height: number;
    /** body 相对 sprite 左上角的 X 偏移（像素） */
    offsetX: number;
    /** body 相对 sprite 左上角的 Y 偏移（像素） */
    offsetY: number;

    constructor(width: number, height: number, offsetX: number, offsetY: number) {
        this.width = width;
        this.height = height;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
    }
}

/** 移动数据组件 */
export class MovementComponent implements Component {
    readonly type = 'movement';
    dx: number = 0;
    dy: number = 0;
    speed: number = 0;
    walkSpeed: number = 50;
    runSpeed: number = 100;
    isRunning: boolean = false;
}

/** 动画状态数据组件 */
export class AnimationComponent implements Component {
    readonly type = 'animation';
    currentState: string = 'idle';
    facing: 'right' | 'down' | 'up' = 'down';
}

/** 玩家输入数据组件 */
export class InputComponent implements Component {
    readonly type = 'input';
    cursors!: Types.Input.Keyboard.CursorKeys;
    upKey!: Input.Keyboard.Key;      // W
    downKey!: Input.Keyboard.Key;    // S
    leftKey!: Input.Keyboard.Key;    // A
    rightKey!: Input.Keyboard.Key;   // D
    shiftKey!: Input.Keyboard.Key;
    inventoryKey!: Input.Keyboard.Key;
    /** 鼠标世界坐标 X */
    mouseX: number = 0;
    /** 鼠标世界坐标 Y */
    mouseY: number = 0;
}

/** 攻击状态数据组件 */
export class AttackComponent implements Component {
    readonly type = 'attack';
    isAttacking: boolean = false;
    hitCheckDelay: number = 0;      // 判定启动延迟（ms），倒计时到 0 才开始判定
    hitCheckDuration: number = 0;   // 判定持续时间（ms），>0 时处于判定窗口
    attackDuration: number = 0;     // 攻击动画总持续时间（ms），用于替代 isPlaying 检测
}

/** 敌人 AI 数据组件 */
export class AIComponent implements Component {
    readonly type = 'ai';
    patrolCenterX: number = 0;
    patrolCenterY: number = 0;
    patrolRadius: number = 50;
    chaseRange: number = 80;     // 发现玩家并开始追逐的距离（角色碰撞体 10x10，按视觉比例设定）
    attackRange: number = 20;    // 进入攻击范围的距离（贴近到角色接触范围才攻击）
}

/** 玩家标记组件（空标记，用于 ECS 查询相机目标） */
export class PlayerComponent implements Component {
    readonly type = 'player';
}

/** 渲染外观数据组件 */
export class RenderComponent implements Component {
    readonly type = 'render';
    tint: number | undefined = undefined;
}

/** 生命值数据组件 */
export class HealthComponent implements Component {
    readonly type = 'health';
    hp: number = 100;
    maxHp: number = 100;
}

/** 受击硬直数据组件 */
export class HitStunComponent implements Component {
    readonly type = 'hitstun';
    isHit: boolean = false;
    damage: number = 0;
    knockbackX: number = 0;
    knockbackY: number = 0;
    stunTimer: number = 0;
    flashTimer: number = 0;
    hitAnimTimer: number = 0;
}

// ============================================================
// 道具与库存系统
// ============================================================

/** 道具定义（来自 items-map.json） */
export interface ItemDefinition {
    id: string;
    name: string;
    description: string;
    type: 'consumable' | 'equipment' | 'material';
    stackable: boolean;
    maxStack: number;
    width: number;
    height: number;
    usable?: boolean;
    /**
     * 使用效果。支持多种 type:
     * - `heal`: 立即恢复 `value` 点生命
     * - `apply_buff`: 施加 `buffId` 指定的 buff，持续 `duration` 毫秒
     * - `restore_needs`: 恢复 `needsType` 指定的需求值 `value` 点（如饥饿/口渴）
     */
    useEffect?: {
        type: string;
        value?: number;
        target?: string;
        buffId?: string;
        duration?: number;
        needsType?: 'hunger' | 'thirst';
    };
    equipment?: { slot: string; attack?: number; defense?: number };
    value?: number;
    /** 购买价格：物品ID → 数量（为空则不能购买） */
    buyPrice?: Record<string, number>;
    /** 出售价格：物品ID → 数量（为空则不能出售） */
    sellPrice?: Record<string, number>;
}

/** 库存中的单个道具实例 */
export interface InventoryItem {
    itemId: string;
    quantity: number;
}

/** 库存组件：存储实体拥有的道具 */
export class InventoryComponent implements Component {
    readonly type = 'inventory';
    capacity: number = 20;
    items: (InventoryItem | null)[] = [];

    constructor(capacity: number = 20) {
        this.capacity = capacity;
        this.items = new Array(capacity).fill(null);
    }
}

/** 全局设置组件：存储 UI 缩放等全局配置 */
export class SettingsComponent implements Component {
    readonly type = 'settings';
    uiScale: number = 0.5;
}

/** 全局 UI 状态组件：用于各 UI 系统之间协调 */
export class UIStateComponent implements Component {
    readonly type = 'uistate';
    inventoryOpen = false;
    containerOpen = false;
    storeOpen = false;
    /** 鼠标是否悬停在左下角快捷栏区域（用于 InputSystem 跳过攻击） */
    pointerInHotbar = false;
    /** 快捷栏 4 个槽位的世界坐标矩形（由 HotbarUISystem 每帧写入，供 InventoryUISystem 拖放命中检测） */
    hotbarSlotRects: { x: number; y: number; size: number }[] = [];
    /** 当前交互的容器实体 */
    activeContainer: Entity | null = null;
    /** 当前交互的商店实体 */
    activeStore: Entity | null = null;
    /** 银行 UI 是否打开 */
    bankOpen = false;
    /** 当前交互的银行实体 */
    activeBank: Entity | null = null;
}

/** 容器标记组件 */
export class ContainerComponent implements Component {
    readonly type = 'container';
    /** 交互提示文字（如"按 E 打开"） */
    promptText: string = '宝箱';
}

/** 掉落组件：标记实体死亡时触发掉落 */
export class DropComponent implements Component {
    readonly type = 'drop';
    /** 掉落表 key（对应 drops-map.json） */
    dropTable: string;

    constructor(dropTable: string = 'default_enemy') {
        this.dropTable = dropTable;
    }
}

/** 地面物品组件：标记可被拾取的掉落物 */
export class GroundItemComponent implements Component {
    readonly type = 'grounditem';
    itemId: string;
    quantity: number;

    constructor(itemId: string, quantity: number) {
        this.itemId = itemId;
        this.quantity = quantity;
    }
}

/** 商店组件：标记实体为商店NPC */
export class StoreComponent implements Component {
    readonly type = 'store';
    /** 商店名称（显示在UI标题中） */
    name: string;
    /** 出售的商品列表 */
    goods: InventoryItem[];

    constructor(name: string = '商人') {
        this.name = name;
        this.goods = [];
    }
}

/** 装备槽组件：存储角色已装备的道具 */
export class EquipmentSlotComponent implements Component {
    readonly type = 'equipment_slots';
    weapon: InventoryItem | null = null;
    armor: InventoryItem | null = null;
    helmet: InventoryItem | null = null;
}

/** 角色属性组件：存储攻击/防御等战斗属性 */
export class AttributeComponent implements Component {
    readonly type = 'attribute';
    /** 基础攻击力 */
    baseAttack: number = 0;
    /** 基础防御力 */
    baseDefense: number = 0;
    /** 当前总攻击力（基础 + 装备加成） */
    attack: number = 0;
    /** 当前总防御力（基础 + 装备加成） */
    defense: number = 0;
}

/** 快捷栏组件：4 个槽位，独立存储物品（语义同 InventoryComponent.items，仅容量 4） */
export class HotbarComponent implements Component {
    readonly type = 'hotbar';
    /** 槽位物品，null 表示空槽 */
    slots: (InventoryItem | null)[] = [null, null, null, null];
}

/** 银行组件：存储玩家存入银行的金币 */
export class BankComponent implements Component {
    readonly type = 'bank';
    /** 银行金币余额 */
    gold: number = 0;
}

/** 银行 NPC 标记组件 */
export class BankNPCComponent implements Component {
    readonly type = 'bank_npc';
    /** NPC 名称 */
    name: string;

    constructor(name: string = '银行职员') {
        this.name = name;
    }
}

// ============================================================
// Buff 系统
// ============================================================

/** Buff 效果配置 */
export interface BuffEffect {
    /** 效果类型 */
    type: 'heal_over_time' | 'damage_over_time';
    /** 每次 tick 的数值 */
    value: number;
    /** tick 间隔（ms），决定多久触发一次效果 */
    interval: number;
}

/** Buff 定义（来自 buffs-map.json）。持续时间不在配置里，由附加 buff 时传入 */
export interface BuffDefinition {
    id: string;
    name: string;
    description: string;
    effect: BuffEffect;
}

/** Buff 实例：实体身上正在生效的 buff 运行时状态（由 BuffSystem 实例化和维护） */
export interface BuffInstance {
    /** 对应 buffs-map.json 中的 id */
    buffId: string;
    /** 剩余持续时间（ms），-1 表示永久 */
    remainingDuration: number;
    /** 距离下一次 tick 触发的剩余时间（ms） */
    nextTickIn: number;
}

/**
 * 待添加 buff 请求（纯数据：字符串 + 数字）。
 * 外部代码只允许通过往 BuffComponent.pendingBuffs 推入这种数据来"请求"添加 buff，
 * 真正的 BuffInstance 由 BuffSystem 在 update 中根据 buffsMap 实例化。
 */
export interface PendingBuff {
    /** 对应 buffs-map.json 中的 id */
    buffId: string;
    /** 持续时间（ms），-1 表示永久 */
    duration: number;
}

/**
 * Buff 组件：实体的 buff 数据（纯数据，无方法）。
 * - buffs：当前生效的 buff 实例，仅由 BuffSystem 写入/读取
 * - pendingBuffs：外部 push 即可申请添加 buff（id+duration），BuffSystem 下一帧处理
 * - removeBuffIds：外部 push buffId 即可申请移除，BuffSystem 下一帧处理
 */
export class BuffComponent implements Component {
    readonly type = 'buff';
    buffs: BuffInstance[] = [];
    pendingBuffs: PendingBuff[] = [];
    removeBuffIds: string[] = [];
}

// ============================================================
// 需求系统（饥饿 / 口渴）
// ============================================================

/**
 * 需求变化请求（纯数据），外部 push 到 NeedsComponent.pendingDeltas 即可申请变化。
 * 字段值正数为恢复、负数为消耗；缺失的字段不变化。
 */
export interface NeedsDelta {
    hunger?: number;
    thirst?: number;
}

/**
 * 需求组件：玩家的基础需求值（饥饿、口渴等）。
 * - hunger/maxHunger、thirst/maxThirst：运行时数值，仅由 NeedsSystem 写入
 * - pendingDeltas：外部 push 即可申请变化（如吃面包恢复 30 饥饿）
 */
export class NeedsComponent implements Component {
    readonly type = 'needs';
    hunger: number = 100;
    maxHunger: number = 100;
    thirst: number = 100;
    maxThirst: number = 100;
    pendingDeltas: NeedsDelta[] = [];
}
