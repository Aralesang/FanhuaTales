# FanhuaTales / 繁花物语 — 项目规范与架构

## 项目概述

这是一个基于 Phaser 4 + TypeScript + Vite 构建的像素风 RPG 项目。核心特点是：JSON 驱动的动态资源加载、三行式方向性精灵表（右/下/上）、TiledMap 场景集成，以及通过相机缩放而非精灵缩放来实现统一的像素比例。

## 技术栈

- Phaser 4 (ESM 模块)
- TypeScript 5
- Vite 8
- Tiled 地图编辑器

---

## 绝对规范：Phaser 导入规则

**所有 Phaser 成员必须从 `phaser` 包显式导入，禁止通过全局 `Phaser` 命名空间访问。**

正确示例：

```typescript
import { Scene, GameObjects, Physics, Types, Input, Tilemaps } from 'phaser';

// 类型声明
private body!: Physics.Arcade.Body;
private map!: Tilemaps.Tilemap;
private debugKey!: Input.Keyboard.Key;
private cursors: Types.Input.Keyboard.CursorKeys;
```

常见映射：
- `Phaser.Physics.Arcade.Body` → `Physics.Arcade.Body`
- `Phaser.Tilemaps.Tilemap` → `Tilemaps.Tilemap`
- `Phaser.Types.Core.GameConfig` → `Types.Core.GameConfig`
- `Phaser.Input.Keyboard.Key` → `Input.Keyboard.Key`
- `Phaser.Input.Keyboard.KeyCodes` → `Input.Keyboard.KeyCodes`

**此规则适用于所有源码文件，无例外。**

---

## 场景架构

### 场景列表与职责

| 场景 | 文件 | 职责 |
|------|------|------|
| BootScene | `src/scenes/BootScene.ts` | 加载资源映射表(images-map.json, maps-map.json)，动态加载 spritesheet、tilemap、tileset 图片，自动创建方向性动画，启动 GameScene |
| GameScene | `src/scenes/GameScene.ts` | 创建 tilemap 各图层，读取 Tiled Object Layer 放置玩家和配置相机，设置碰撞、相机跟随、debug 开关 |

场景注册顺序：`[BootScene, GameScene]`

### BootScene 动态加载流程

1. `preload()` 中加载 `data/images-map.json` 和 `data/maps-map.json`
2. `create()` 中读取两个 JSON，以 `maps-map.json` 的第一个 key 作为默认场景
3. 遍历 `images-map.json` 用 `load.spritesheet()` 加载角色图
4. 用 `load.tilemapTiledJSON()` 加载地图 JSON（路径来自 maps-map，将 `.tmx` 替换为 `.json`）
5. 预加载 tileset 图片：`surface`、`building`、`solid`
6. `onLoadComplete()` 中自动创建动画，然后 `scene.start('GameScene', { mapKey })`

---

## 精灵表与动画规范

### 精灵表布局约定

所有角色精灵表必须严格遵循 **3 行 × N 列** 的布局：

- **第 1 行**：向右（`right`）
- **第 2 行**：向下（`down`）
- **第 3 行**：向上（`up`）

向左（`left`）通过 `setFlipX(true)` 镜像实现，**不提供独立的向左动画**。

### 动画命名约定

动画 key 的格式为：`<spritesheet_key>_<direction>`

例如 `images-map.json` 中定义了 `human_walk`，BootScene 会自动生成：
- `human_walk_right`
- `human_walk_down`
- `human_walk_up`

### images-map.json 格式

```json
{
    "human_idle": {
        "path": "./images/human/idle.png",
        "grid": {
            "rows": 3,
            "columns": 4,
            "spriteWidth": 80,
            "spriteHeight": 80
        },
        "animationStrategy": "loop"
    }
}
```

- `animationStrategy`: `loop`（循环播放，如 idle/walk/run）或 `freeze`（播放一次后冻结，如 sword 攻击）
- `path` 相对于 `public/` 目录，以 `./` 开头

---

## 玩家实体（Player）

### 文件
`src/entity/Player.ts`

### ECS 组装
Player 继承 `Entity` 基类，构造函数中仅负责挂载组件：

```typescript
export class Player extends Entity {
    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'human_idle');
        this.addComponent(new MovementComponent());
        this.addComponent(new AnimationComponent());
        this.addComponent(new AttackComponent());
        this.addComponent(new PlayerComponent());
        this.addComponent(new InputComponent());
    }
}
```

### 状态机（由系统驱动）

状态类型：`idle` | `walk` | `run` | `attack`

- **idle**：速度接近 0（`AnimationSystem` 判定）
- **walk**：速度在 walk 阈值以内（当前 `walkSpeed = 50`）
- **run**：速度超过 walk 阈值（当前 `runSpeed = 100`）
- **attack**：`AttackComponent.isAttacking = true` 期间锁定移动和状态切换

### 输入控制（由 `InputSystem` 处理）

| 按键 | 功能 |
|------|------|
| 方向键 | 移动，支持八方向 |
| Shift | 奔跑（速度从 50 提升至 100）|
| X | 攻击（触发 `human_sword_<facing>` 动画，期间不可移动）|

---

## ECS 架构规范

**本项目整体架构严格遵循 Entity-Component-System (ECS)。这是不可妥协的设计原则，所有新增功能和修改都必须符合 ECS 规范。**

核心原则：**数据与逻辑完全分离**。实体只负责组装组件，组件只存储数据，系统只根据数据执行逻辑。任何试图在实体或组件中嵌入业务逻辑的做法都必须被拒绝。

### 三大要素的职责边界

| 要素 | 职责 | 绝对禁止 |
|------|------|----------|
| **Entity（实体）** | 继承 `GameObjects.Sprite`，负责组件的组装与挂载，**本质上是组件工厂** | 包含业务逻辑、存储状态数据 |
| **Component（组件）** | 纯数据结构，仅存储实体的属性与状态 | 包含任何方法、逻辑、输入检测、动画调用 |
| **System（系统）** | 遍历所有实体，根据组件数据执行逻辑，**纯数据驱动** | 直接持有实体引用、关心实体的具体身份（Player/Enemy） |

### 实体即工厂

Entity 基类只提供 `addComponent` / `getComponent` / `hasComponent` 方法。子类（如 `Player`、`Enemy`）的构造函数唯一职责是实例化并挂载所需组件，除此之外**不实现任何 update 逻辑**。

```typescript
// Player.ts —— 只负责组件组装
export class Player extends Entity {
    constructor(scene: Scene, x: number, y: number) {
        super(scene, x, y, 'human_idle');
        this.addComponent(new MovementComponent());
        this.addComponent(new AnimationComponent());
        this.addComponent(new AttackComponent());
        this.addComponent(new InputComponent());
    }
}
```

### 组件只允许存储数据

组件必须是纯数据对象，所有字段必须是公开的可读写属性，禁止定义任何方法。

```typescript
// 正确：纯数据
export class MovementComponent {
    readonly type = 'movement';
    dx: number = 0;
    dy: number = 0;
    speed: number = 0;
    walkSpeed: number = 50;
    runSpeed: number = 100;
    isRunning: boolean = false;
}

// 错误：组件中掺杂逻辑
export class MovementComponent {
    move() { ... }  // ❌ 方法不允许
}
```

### 系统纯数据驱动，对实体一视同仁

系统通过 `hasComponent()` 筛选符合条件的实体，**不关心实体的具体类型**。同一个 System 对 Player 和 Enemy 一视同仁，只根据组件数据执行行为。

```typescript
export class AttackSystem extends System {
    update(entities: Entity[]): void {
        for (const entity of entities) {
            if (!entity.hasComponent('attack')) continue;

            const attack = entity.getComponent<AttackComponent>('attack')!;
            // 只关心 isAttacking 的值，不关心是谁设置的
            if (attack.isAttacking) {
                // 执行攻击行为
            }
        }
    }
}
```

### 关键设计原则

1. **状态写入与行为执行必须分离**
   - 输入系统（`InputSystem`）负责检测按键并将意图写入 `AttackComponent.isAttacking = true`
   - 攻击系统（`AttackSystem`）负责检测 `isAttacking` 从 `false → true` 的状态变化，执行动画、音效、速度锁定等行为
   - 动画完成后由 `AttackSystem` 将 `isAttacking` 自动设回 `false`

2. **系统更新顺序至关重要**
   每帧更新顺序决定了行为正确性：
   ```
   InputSystem → EnemyAISystem → AttackSystem → MovementSystem → AnimationSystem
   ```
   - `InputSystem` 先于 `AttackSystem`：确保按键检测在行为执行之前完成
   - `AttackSystem` 先于 `MovementSystem`：攻击期间需要速度归零，如果移动系统先运行会被覆盖
   - `MovementSystem` 先于 `AnimationSystem`：动画需要根据物理速度来切换

3. **实体通过组件组合区分行为**
   - Player 拥有 `input` + `attack` 组件 → 可由输入触发攻击
   - Enemy 拥有 `ai` + `movement` 组件 → 由 AI 系统驱动，不会响应输入
   - 未来给 Enemy 添加 `attack` 组件后，AttackSystem 会自动处理敌人攻击，无需修改系统代码

4. **系统之间通过组件数据通信**
   - 系统 A 修改组件数据 → 系统 B 在下一帧读取同一组件数据 → 无需直接调用
   - 禁止系统之间直接调用方法或持有对方引用

5. **Scene 不持有具体实体引用**
   - GameScene 中禁止声明 `private player!: Player` 这类强类型引用
   - 所有实体统一放在 `Entity[]` 数组中管理
   - 需要通过特定实体时，通过组件查询：`entities.find(e => e.hasComponent('player'))`
   - 相机跟随、碰撞设置等也必须通过组件查找目标实体，而非直接引用

6. **实体的外观与初始化也是数据**
   - 即使是 `setTint` 这类一次性的外观设置，也不允许直接写在实体构造函数中
   - 外观数据必须存储在组件（如 `RenderComponent.tint`）中
   - 由 Scene 在实体创建完成后根据组件数据统一应用初始化

### 当前组件列表

| 组件名 | 存储的数据 | 被哪些系统使用 |
|--------|-----------|-------------|
| `MovementComponent` | dx, dy, speed, walkSpeed, runSpeed, isRunning | InputSystem, MovementSystem, AnimationSystem |
| `AnimationComponent` | currentState, facing | MovementSystem, AttackSystem, AnimationSystem |
| `InputComponent` | cursors, attackKey, shiftKey | InputSystem |
| `AttackComponent` | isAttacking | AttackSystem, MovementSystem, AnimationSystem |
| `AIComponent` | patrolCenterX, patrolCenterY, patrolRadius | EnemyAISystem |
| `PlayerComponent` | （空标记） | GameScene（相机目标查找） |
| `RenderComponent` | tint | GameScene（外观初始化） |

---

## TiledMap 集成规范

### 地图数据
- 地图 JSON 文件放在 `public/maps/<sceneName>/<sceneName>.json`
- `maps-map.json` 中记录 key → 路径的映射（**不带 `public/` 前缀**）
- 示例：`{"village": "maps/village/village.json"}`

### 致命规则：tileset 必须内嵌

Phaser 无法解析外部 `.tsx` 文件。从 Tiled 导出 JSON 时，**必须将 tileset 数据内嵌到 JSON 中**（取消 Tiled 中 "Embed tilesets" 的勾选状态的反面，即选择嵌入）。

如果看到运行时错误 `Cannot read properties of undefined (reading '2')`，99% 是 JSON 中仍然包含 `source: "building.tsx"` 之类的外部引用。

### Tileset Name 与 Cache Key 映射

Tiled 中 tileset 的 name 必须与 Phaser 中 `load.image()` 和 `addTilesetImage()` 使用的 key 严格对应：

| Tileset Name | 加载路径 | 用途 |
|-------------|---------|------|
| `surface` | `images/map/village/FDR_Ground_Tiles.png` | 地面、土壤、草地 |
| `building` | `images/map/village/FDR_Village.png` | 建筑、装饰、 flower |
| `solid` | `images/map/solid.png` | 碰撞层（纯色 tileset，仅用于碰撞检测）|

### 图层规范

绘制顺序（自下而上）：
1. `soil` (surface)
2. `grass` (surface)
3. `flower` (**building** — GID 落在 building tileset 范围内)
4. `building` (building)
5. `building2` (building)
6. `building3` (building)
7. `solid` (solid) — **碰撞层，setAlpha(0) 隐藏，setCollisionByExclusion([-1]) 开启碰撞**

### Object Layer（`Objects`）

Tiled 中需创建名为 `Objects` 的对象层，用于放置各种实体和配置点。

**重要规则：实体类型由 `type` 属性决定，而非 `name` 属性。** `name` 用于标识具体实例（如角色名字），`type` 用于代码中判断应实例化什么实体。在 Tiled 的 Object 属性面板中，`Type`（或 `Class`）字段填写实体类型，`Name` 字段填写实例名称。

当前支持的实体类型：

| Type 值 | 用途 | 代码处理 |
|---------|------|----------|
| `Player` | 玩家出生点 | 读取 `x`、`y` 作为玩家初始位置（默认值 240, 160） |
| `Enemy` | 敌人出生点 | 读取 `x`、`y` 创建 `Enemy` 实例 |
| `camera` | 相机参数 | 通过 properties 数组读取 `zoom` 值（默认值 3） |

---

## 渲染与物理配置

### main.ts 关键配置

```typescript
render: {
    pixelArt: true,      // 启用 NEAREST 纹理过滤
    roundPixels: false   // 必须与相机同步关闭，否则配合 zoom 会产生抖动
},
physics: {
    default: 'arcade',
    arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
        fixedStep: false   // 与渲染帧率同步，消除移动残影/抖动
    }
}
```

### 像素比例策略

**禁止直接缩放精灵。** 统一像素比例通过相机 zoom 实现：

```typescript
this.cameras.main.setZoom(3);          // 在 GameScene 中从 Tiled camera 对象读取
this.cameras.main.roundPixels = false;  // 必须与 render.roundPixels 同步
```

`pixelArt: true` 会自动将 `roundPixels` 设为 true，因此需要在游戏配置和相机中**显式覆盖为 false**。如果忘记这一点，物理体的浮点坐标与整数像素取整之间会产生明显的抖动和残影。

### 相机跟随

```typescript
this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
```

使用线性插值跟随，值为 `0.1` 时获得平滑的延迟跟随效果。

---

## Debug 工具

在 GameScene 中按 **F9** 切换物理碰撞器可视化：

```typescript
this.debugKey = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.F9);
```

通过 `physics.world.drawDebug` 和 `createDebugGraphic()` 控制。

---

## 目录结构

```
public/
  data/
    images-map.json      # 精灵表配置
    maps-map.json        # 场景映射表
    sounds-map.json      # 音效配置
  images/
    human/
      idle.png
      walk.png
      run.png
      sword.png
    map/
      village/
        FDR_Ground_Tiles.png
        FDR_Village.png
      solid.png
  sounds/
    07_human_atk_sword_1.wav
  maps/
    village/
      village.json       # Tiled 导出 JSON（tileset 已内嵌）
    interior/
      interior.json
src/
  ecs/
    Entity.ts            # 实体基类（组件工厂）
    Component.ts         # 纯数据组件定义
    System.ts            # 系统抽象基类
  entity/
    Player.ts            # 玩家实体（组件组装）
    Enemy.ts             # 敌人实体（组件组装）
  systems/
    InputSystem.ts       # 输入→数据转换
    EnemyAISystem.ts     # AI→数据转换
    AttackSystem.ts      # 攻击行为执行
    MovementSystem.ts    # 移动行为执行
    AnimationSystem.ts   # 动画状态切换
  scenes/
    BootScene.ts         # 资源加载与动画创建
    GameScene.ts         # 主游戏场景、系统编排
  main.ts                # 游戏配置与启动
index.html
package.json
vite.config.ts
```

---

## 常见陷阱与排查

### 1. "Cannot read properties of undefined (reading '2')" 在 tilemap 创建时
- **原因**：Tiled JSON 中 tileset 是外部引用（`source: ".tsx"`）
- **解决**：重新从 Tiled 导出 JSON，确保 tileset 数据已内嵌

### 2. 某图层不显示
- **原因**：图层的 tile GID 属于某个 tileset，但 `createLayer()` 时绑定了错误的 tileset
- **解决**：检查 Tiled 中该图层实际使用的 tileset，确保 `addTilesetImage` 和 `createLayer` 的 key 匹配（例如 flower 层实际使用 building tileset）

### 3. 碰撞框偏移（紫色框在左上角）
- **原因**：`super(scene, x, y, 'xxx')` 中传入了动画 key 而非 texture key，导致 Phaser 创建了 32x32 的缺失纹理
- **解决**：构造函数第一个 texture key 必须是 `images-map.json` 中定义的 spritesheet key（如 `'human_idle'`），而非动画 key（如 `'human_idle_right'`）

### 4. 角色移动抖动/残影
- **原因**：`pixelArt: true` 自动启用 `roundPixels`，与浮点物理坐标和相机 zoom 冲突
- **解决**：在 `main.ts` 的 `render` 中显式设置 `roundPixels: false`，在 GameScene 中设置 `this.cameras.main.roundPixels = false`，并在 physics arcade 中设置 `fixedStep: false`

### 5. TypeScript 报错 "Property 'setVelocity' does not exist on type 'Player'"
- **原因**：`physics.add.existing()` 不会在类型层面扩展类
- **解决**：通过类型断言访问：`(this.body as Physics.Arcade.Body).setVelocity(...)`

### 6. 模块找不到 Sprite
- **原因**：Phaser 4 ESM 不直接导出 `Sprite`，而是通过 `GameObjects.Sprite`
- **解决**：`import { GameObjects } from 'phaser'; class Player extends GameObjects.Sprite`

---

## 修改 checklist

当修改以下方面时，请同时检查关联配置：

- **修改 WALK_SPEED / RUN_SPEED** → 检查 `updateAnimationState()` 中的速度阈值判断是否需要同步调整
- **新增精灵表** → 在 `images-map.json` 中添加条目，遵循 3 行 × N 列布局
- **新增/修改地图** → 在 `maps-map.json` 中添加映射，确保 Tiled JSON 中 tileset 已内嵌，检查图层使用的 tileset 是否正确
- **修改物理体大小** → 在 Player 构造函数中同步调整 `body.setSize(w, h)`，确保与角色实际像素大小匹配
- **修改相机 zoom** → 可在 Tiled 的 camera 对象 properties 中调整 zoom 值，无需修改代码
