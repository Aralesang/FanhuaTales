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
    attackKey!: Input.Keyboard.Key;
    shiftKey!: Input.Keyboard.Key;
    inventoryKey!: Input.Keyboard.Key;
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
    useEffect?: { type: string; value: number; target: string };
    equipment?: { slot: string; attack?: number; defense?: number };
    value: number;
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
    /** 当前交互的容器实体 */
    activeContainer: Entity | null = null;
}

/** 容器标记组件 */
export class ContainerComponent implements Component {
    readonly type = 'container';
    /** 交互提示文字（如"按 E 打开"） */
    promptText: string = '宝箱';
}
