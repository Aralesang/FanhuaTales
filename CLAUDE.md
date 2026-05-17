# FanhuaTales / 繁花物语 — 项目规范与架构

> 一份给 Claude 新会话快速重新开始用的项目知识库。

---

## 1. 项目概况

像素风 2D RPG,基于 **Phaser 4 + TypeScript + Vite**,以 **Electron** 封装为桌面应用。核心特点:JSON 驱动的动态资源加载、三行式方向性精灵表(右/下/上)、TiledMap 场景集成、相机缩放(非精灵缩放)统一像素比例。

**项目根目录**: `D:\MyProjects\Phaser\FanhuaTales` (所有操作都在主目录进行,不要使用 `.claude/worktrees/...` 临时目录)

**当前分支**: `main`,最新 commit `19c1344 修复源码中所有 TypeScript 严格模式错误`

---

## 2. 快速上手(新会话首选阅读)

```bash
# 1. 进入主目录
cd D:\MyProjects\Phaser\FanhuaTales

# 2. 日常开发(并行启动 Vite dev server + Electron,带热更新)
npm run dev

# 3. 完整生产构建(tsc 严格检查 + vite build + Electron 主进程编译)
npm run build

# 4. 启动已构建的产物(等价于 build + electron .)
npm start
```

如果只想在浏览器里调试渲染层(不开 Electron):

```bash
npm run dev:vite   # 单独跑 Vite,访问 http://localhost:8000
```

---

## 3. 技术栈

- **Phaser 4** (ESM 模块)
- **TypeScript 5** (严格模式,`noUnusedLocals`/`noUnusedParameters` 启用,详见 §6)
- **Vite 8** (开发服务器 + 生产构建)
- **Electron 42** (桌面封装,详见 §5)
- **Tiled** (地图编辑器,JSON 导出)

---

## 4. 项目结构

```
D:\MyProjects\Phaser\FanhuaTales\
├── electron/                       # Electron 主进程(独立的 TS 编译单元)
│   ├── main.ts                     # 主进程:BrowserWindow + dev/prod URL 切换
│   ├── preload.ts                  # 预加载脚本(contextIsolation 安全骨架,目前为空)
│   └── tsconfig.json               # CommonJS 编译配置,outDir = ../dist-electron
│
├── public/                         # 静态资源(被 Vite 原样复制到 dist/)
│   ├── data/
│   │   ├── images-map.json         # 精灵表配置(角色 + 物品 + 容器)
│   │   ├── maps-map.json           # 场景 key → Tiled JSON 路径
│   │   ├── sounds-map.json         # 音效 key → 文件路径
│   │   ├── items-map.json          # 道具定义(类型/价格/装备属性)
│   │   ├── drops-map.json          # 敌人掉落表
│   │   └── buffs-map.json          # Buff 定义(效果/间隔/持续时间)
│   ├── fonts/                      # 像素位图字体(VonwaonBitmap-12/16px)
│   ├── images/
│   │   ├── human/                  # 角色精灵表(idle/walk/run/sword,均 3 行)
│   │   ├── item/                   # 物品图标
│   │   ├── map/                    # tileset 图片(surface/building/solid + 多套备选)
│   │   └── 宝箱1.png                # 容器精灵表(5 列,freeze)
│   ├── maps/                       # Tiled 导出的 JSON(tileset 必须内嵌)
│   ├── music/                      # 背景音乐
│   └── sounds/                     # 音效
│
├── src/                            # 渲染层源码
│   ├── config/
│   │   └── FontConfig.ts           # 全局字体配置(large / normal / small)
│   ├── ecs/                        # ECS 基础设施
│   │   ├── Entity.ts               # 实体基类(组件工厂)
│   │   ├── Component.ts            # 所有 Component 定义(纯数据)
│   │   └── System.ts               # System 抽象基类(提供高分辨率 createText)
│   ├── entity/                     # 具体实体(只负责组件组装)
│   │   ├── Player.ts
│   │   ├── Enemy.ts
│   │   ├── Container.ts            # 宝箱
│   │   ├── Store.ts                # 商店 NPC
│   │   └── Bank.ts                 # 银行 NPC
│   ├── systems/                    # 行为系统
│   │   ├── InputSystem.ts          # 输入→意图(WASD/方向键/鼠标/Shift/X)
│   │   ├── EnemyAISystem.ts        # AI 巡逻/追击/攻击
│   │   ├── AttackSystem.ts         # 攻击行为执行 + 命中判定
│   │   ├── HitSystem.ts            # 硬直/扣血/死亡
│   │   ├── BuffSystem.ts           # Buff 持续效果（每 interval tick 触发，按 duration 自动移除）
│   │   ├── BuffUISystem.ts         # 屏幕右上角 buff 色块 + 剩余时间 + hover tooltip
│   │   ├── MovementSystem.ts       # 数据→物理速度
│   │   ├── AnimationSystem.ts      # 速度+状态→动画切换
│   │   ├── DropSystem.ts           # 敌人死亡→生成掉落物
│   │   ├── PickupSystem.ts         # 玩家拾取地面物品
│   │   ├── InventorySystem.ts      # 库存操作(addItem/removeItem 静态方法)
│   │   ├── InventoryUISystem.ts    # 库存/装备/快捷栏 UI
│   │   ├── HotbarUISystem.ts       # 屏幕左下角固定快捷栏(鼠标点击使用)
│   │   ├── ContainerSystem.ts      # 容器交互(E 键打开)
│   │   ├── StoreSystem.ts          # 商店交互(E 键打开)
│   │   ├── StoreUISystem.ts        # 商店买卖 UI
│   │   ├── BankSystem.ts           # 银行交互(E 键打开)
│   │   ├── BankUISystem.ts         # 银行存取 UI
│   │   └── SystemMenuSystem.ts     # 系统设置(UI 缩放滑块)
│   ├── scenes/
│   │   ├── BootScene.ts            # 资源加载 + 字体加载 + 动画自动创建
│   │   └── GameScene.ts            # tilemap 创建 + 实体实例化 + 系统编排
│   └── main.ts                     # Phaser Game 实例创建
│
├── dist/                           # Vite 构建产物(忽略)
├── dist-electron/                  # tsc -p electron 产物(忽略)
├── node_modules/                   # 依赖(忽略)
│
├── index.html                      # Vite 入口 HTML(含字体 @font-face)
├── package.json                    # main: dist-electron/main.js
├── tsconfig.json                   # 渲染层 TS 配置(严格)
├── tsconfig.node.json              # vite.config.ts 用
├── vite.config.ts                  # base: './' (Electron file:// 必需)
├── .gitignore                      # 忽略 node_modules/.claude/dist/dist-electron
└── CLAUDE.md                       # 本文件
```

---

## 5. Electron 集成

### 主进程入口
`electron/main.ts` 创建 `BrowserWindow`(1280×720,可调整),并通过环境变量切换加载源:

```typescript
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);        // dev: http://localhost:8000
    mainWindow.webContents.openDevTools({ mode: 'detach' });
} else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));  // prod: file://
}
```

### npm 脚本编排

| 脚本 | 作用 |
|------|------|
| `npm run dev` | `concurrently -k` 并行跑 `dev:vite` + `dev:electron`,任一退出会 kill 另一个 |
| `npm run dev:vite` | 单独跑 Vite dev server(8000 端口) |
| `npm run dev:electron` | `wait-on http://localhost:8000` 等就绪 → `tsc -p electron` 编译 main → `cross-env VITE_DEV_SERVER_URL=http://localhost:8000 electron .` |
| `npm run build` | `build:renderer` + `build:electron` |
| `npm run build:renderer` | `tsc` 严格检查 + `vite build` 产出 `dist/` |
| `npm run build:electron` | `tsc -p electron` 产出 `dist-electron/main.js` + `preload.js` |
| `npm start` | `build` 然后 `electron .`(生产模式,加载 file://) |
| `npm run preview` | `vite preview`(纯 Web 预览) |

### 关键配置约束

- **`vite.config.ts` 必须设 `base: './'`**:`file://` 协议下绝对路径会被解析到磁盘根目录
- **资源路径必须用相对路径**:特别注意 `BootScene.loadFonts()` 中 `FontFace('xxx', 'url(fonts/...)')`(无前导 `/`),`load.image/json/audio` 同理
- **`server.open: false`**:由 Electron 加载页面,不让 Vite 自动开浏览器
- **`webPreferences`**:`contextIsolation: true` + `nodeIntegration: false` 安全模型,渲染层游戏代码无法访问 Node API。需要本地文件/存档时,在 `preload.ts` 中通过 `contextBridge.exposeInMainWorld('api', {...})` 受控暴露
- **`electron/tsconfig.json`** 必须用 `module: CommonJS`,因为 Electron 主进程默认 CJS

---

## 6. TypeScript 严格模式

**已修复全部历史遗留 TS 错误**(commit `19c1344`)。当前 tsc 0 error,`npm run build` 完整通过。

主要约束:
- **`noUnusedLocals` / `noUnusedParameters`**:未使用的 import、字段、变量、参数会编译失败。**未使用参数请加 `_` 前缀**(如 `_entities`、`_itemsMap`),tsc 视为故意未使用,不报错。
- **`strict: true`**:`strictNullChecks` 等全启。
- **Phaser 4 类型路径变化**:
  - `GameObjects.Text.TextStyle` ❌ → `Types.GameObjects.Text.TextStyle` ✅
  - `make.graphics({ x, y, add: false })` ❌ → `make.graphics({ x, y }, false)` ✅(`add` 拆成第二个参数)

---

## 7. 绝对规范:Phaser 导入规则

**所有 Phaser 成员必须从 `phaser` 包显式导入,禁止通过全局 `Phaser` 命名空间访问。**

```typescript
import { Scene, GameObjects, Physics, Types, Input, Tilemaps } from 'phaser';

private body!: Physics.Arcade.Body;
private map!: Tilemaps.Tilemap;
private debugKey!: Input.Keyboard.Key;
private cursors: Types.Input.Keyboard.CursorKeys;
```

常见映射:
- `Phaser.Physics.Arcade.Body` → `Physics.Arcade.Body`
- `Phaser.Tilemaps.Tilemap` → `Tilemaps.Tilemap`
- `Phaser.Types.Core.GameConfig` → `Types.Core.GameConfig`
- `Phaser.Input.Keyboard.Key` → `Input.Keyboard.Key`
- `Phaser.Input.Keyboard.KeyCodes` → `Input.Keyboard.KeyCodes`

**此规则适用于所有源码文件,无例外。**

---

## 8. ECS 架构规范

**整体架构严格遵循 Entity-Component-System。这是不可妥协的设计原则,所有新增功能和修改都必须符合。**

核心原则:**数据与逻辑完全分离**。实体只负责组装组件,组件只存储数据,系统只根据数据执行逻辑。

### 三大要素的职责边界

| 要素 | 职责 | 绝对禁止 |
|------|------|----------|
| **Entity** | 继承 `Entity` 基类,负责组件的组装与挂载,**本质上是组件工厂** | 包含业务逻辑、存储状态数据 |
| **Component** | 纯数据结构,仅存储实体的属性与状态 | 包含任何方法、逻辑、输入检测、动画调用 |
| **System** | 遍历所有实体,根据组件数据执行逻辑,**纯数据驱动** | 直接持有实体引用、关心实体的具体身份;**对外暴露任何方法供外部调用**(包括静态/实例方法) |

### 系统独立原则(严格执行,新功能必须遵循)

**不允许从任何位置(包括其他系统、Scene、UI、Entity)直接调用某个 System 的方法。** 系统是封闭单元,只通过两个出入口与外部协作:

- **入口**:外部修改组件中的"待处理数据"(纯字符串/数字标记),系统在自己的 `update` 里轮询并响应
- **出口**:系统在 `update` 中读写组件数据,其他系统在下一次 `update` 中看到变化

参考示例:`BuffSystem` —— 外部加 buff 不调用 `addBuff()`,而是 push 一条 `{buffId, duration}` 到 `BuffComponent.pendingBuffs`;`BuffSystem.update` 自己扫描 pendingBuffs 并实例化为 `BuffInstance`。

任何新增系统必须按此模式开发。历史遗留的静态工具方法(如 `InventorySystem.addItem`)在重构时也应迁移到"组件标记 + 系统轮询"模式。

### 关键设计原则

1. **状态写入与行为执行必须分离**:`InputSystem` 写 `AttackComponent.isAttacking = true`,`AttackSystem` 检测 `false→true` 上升沿后执行动画/音效/速度锁定。
2. **系统更新顺序至关重要**(GameScene.update 中固定为):
   ```
   InputSystem
   → ContainerSystem / StoreSystem / BankSystem (交互检测,可能设置 UIState)
   → InventorySystem
   → EnemyAISystem
   → BuffSystem (按 interval tick 触发 buff 效果,如回血/中毒)
   → HitSystem (扣血/硬直/死亡处理)
   → DropSystem (死亡后生成掉落物,需在 HitSystem 之后)
   → PickupSystem
   → AttackSystem (执行攻击,速度归零)
   → MovementSystem (应用速度,如果攻击中会被锁住)
   → AnimationSystem (根据物理速度+状态切动画)
   → 各 UI 系统 (InventoryUI / HotbarUI / BuffUI / StoreUI / BankUI / SystemMenu)
   ```
3. **实体通过组件组合区分行为**:Player(input+attack)、Enemy(ai+movement+drop)、Container(container+inventory)、Store(store)、Bank(bank_npc)。给 Enemy 加 `attack` 组件即可让其攻击,无需改 AttackSystem。
4. **系统之间只通过组件数据通信**,禁止直接调用方法或持有对方引用。
5. **Scene 不持有具体实体引用**:GameScene 不能有 `private player!: Player`,所有实体在 `entities: Entity[]` 中。需要时用 `entities.find(e => e.hasComponent('player'))` 查找。
6. **实体的外观与初始化也是数据**:`setTint` 等不允许写在实体构造函数中,应通过 `RenderComponent.tint` 存储,Scene 在创建完所有实体后统一应用。

### 当前组件清单

| 组件 | 数据 | 主要使用者 |
|------|------|-----------|
| `SpriteComponent` | sprite (GameObjects.Sprite) | 所有需要渲染的实体 |
| `VisualComponent` | width, height (视觉尺寸,用于距离判定) | EnemyAI/Pickup/Container 交互距离 |
| `BodyConfigComponent` | width, height, offsetX, offsetY (碰撞体相对 sprite 左上角的尺寸与偏移) | 实体构造时通过 `this.applyBodyConfig(...)` 配置 |
| `MovementComponent` | dx, dy, speed, walkSpeed, runSpeed, isRunning | InputSystem, MovementSystem, AnimationSystem |
| `AnimationComponent` | currentState, facing | MovementSystem, AttackSystem, AnimationSystem |
| `InputComponent` | cursors, WASD keys, shiftKey, inventoryKey, mouseX/Y | InputSystem |
| `AttackComponent` | isAttacking, hitCheckDelay/Duration, attackDuration | AttackSystem, MovementSystem, AnimationSystem |
| `AIComponent` | patrolCenter, patrolRadius, chaseRange, attackRange | EnemyAISystem |
| `PlayerComponent` | (空标记) | GameScene 相机目标查找 |
| `RenderComponent` | tint | GameScene 外观初始化 |
| `HealthComponent` | hp, maxHp | HitSystem,血条渲染 |
| `HitStunComponent` | isHit, damage, knockbackX/Y, stunTimer, flashTimer, hitAnimTimer | HitSystem, MovementSystem |
| `BuffComponent` | buffs[] (生效中), pendingBuffs[] ({buffId,duration} 待添加), removeBuffIds[] (待移除) | BuffSystem 轮询处理 pending,推进 tick 与持续时间 |
| `InventoryComponent` | capacity, items[] | InventorySystem, InventoryUISystem |
| `EquipmentSlotComponent` | weapon, armor, helmet | InventoryUISystem,装备加成结算 |
| `AttributeComponent` | baseAttack, baseDefense, attack, defense (含装备加成) | AttackSystem, HitSystem |
| `HotbarComponent` | slots[4] (屏幕左下角 4 个槽位) | HotbarUISystem, InventoryUISystem |
| `SettingsComponent` | uiScale | SystemMenuSystem,各 UI 系统读取缩放 |
| `UIStateComponent` | inventoryOpen, containerOpen, storeOpen, bankOpen, pointerInHotbar, activeContainer/Store/Bank | 全部 UI 系统协调 |
| `ContainerComponent` | promptText | ContainerSystem,容器标记 |
| `DropComponent` | dropTable (drops-map.json 中的 key) | DropSystem |
| `GroundItemComponent` | itemId, quantity | PickupSystem |
| `StoreComponent` | name, goods[] | StoreSystem, StoreUISystem |
| `BankComponent` | gold (银行存款) | BankSystem, BankUISystem |
| `BankNPCComponent` | name | BankSystem,银行 NPC 标记 |

### 实体清单

| 实体 | 组件组合 | 来源 |
|------|---------|------|
| `Player` | sprite, visual, movement, animation, input, attack, health, hitstun, attribute, inventory, equipment_slots, hotbar, player, render | GameScene 在 Tiled `Player` Object 位置实例化 |
| `Enemy` | sprite, visual, movement, animation, ai, attack, health, hitstun, attribute, drop, render | Tiled `Enemy` Object |
| `Container` | sprite, visual, container, inventory | Tiled `Container` Object(物品通过 properties 配置) |
| `Store` | sprite, visual, store, inventory | Tiled `Store` Object(商品通过 properties 配置) |
| `Bank` | sprite, visual, bank_npc | Tiled `Bank` Object |
| (settings entity) | settings | GameScene 创建,全局唯一 |
| (uistate entity) | uistate | GameScene 创建,全局唯一 |

---

## 9. 精灵表与动画规范

### 布局约定:3 行 × N 列

- **第 1 行**:向右(`right`)
- **第 2 行**:向下(`down`)
- **第 3 行**:向上(`up`)

向左 = `setFlipX(true)` 镜像,**不提供独立的向左动画**。

### 动画命名:`<spritesheet_key>_<direction>`

`images-map.json` 中定义 `human_walk` → BootScene 自动生成 `human_walk_right` / `human_walk_down` / `human_walk_up`。

### `images-map.json` 格式

```json
{
    "human_idle": {
        "path": "./images/human/idle.png",
        "grid": { "rows": 3, "columns": 4, "spriteWidth": 80, "spriteHeight": 80 },
        "animationStrategy": "loop"
    }
}
```

- `animationStrategy`: `loop`(循环播放,如 idle/walk/run) 或 `freeze`(播放一次后冻结,如 sword 攻击、宝箱开启)
- `path` 相对于 `public/` 目录,以 `./` 开头
- `rows !== 3` 的精灵表 BootScene 不会生成方向性动画(用于物品图标等单帧或非角色精灵)

---

## 10. TiledMap 集成规范

### 地图数据
- Tiled JSON 放在 `public/maps/<sceneName>/<sceneName>.json`
- `maps-map.json` 记录 key → 路径(**不带 `public/` 前缀**):`{"village": "maps/village/village.json"}`

### 致命规则:tileset 必须内嵌
Phaser 无法解析外部 `.tsx` 文件。Tiled 导出 JSON 时**必须选择内嵌 tileset 数据**。

报错 `Cannot read properties of undefined (reading '2')` 99% 是 JSON 中仍含 `"source": "xxx.tsx"`。

### Tileset Name ↔ Cache Key

**GameScene 已改为动态加载 tileset**：遍历 Tiled JSON 中的 `tilesets` 数组，对每个 tileset 调用 `addTilesetImage(name, name)`，再统一传入 `createLayer(..., allTilesets, ...)` 自动匹配 GID。因此不同地图可用完全不同的 tileset 组合。

当前预加载的 tileset 图片（BootScene）：

| Tileset Name | 加载路径 | 用途 |
|-------------|---------|------|
| `surface` | `images/map/village/FDR_Ground_Tiles.png` | 地面、土壤、草地（village） |
| `building` | `images/map/village/FDR_Village.png` | 建筑、装饰（village） |
| `interior` | `images/map/village/FG_Interior.png` | 室内家具、墙壁、地板（interior） |
| `solid` | `images/map/solid.png` | 碰撞层（纯色，仅用于碰撞检测） |

### 图层绘制顺序

图层按 Tiled JSON 中的顺序**自下而上**创建。`solid` 图层名固定作为碰撞层：`setAlpha(0)` 隐藏 + `setCollisionByExclusion([-1])`。其他图层名由 Tiled 决定（如 village 的 `soil`/`grass`/`flower`/`building`…，interior 的 `地板`/`地毯`/`墙壁`/`家具`…）。

### Object Layer(`Objects`)

实体类型由 **`type` 属性** 决定,**不是 `name`**。`name` 用于标识实例(如商店名/NPC 名)。

| Type 值 | 用途 | 处理 |
|---------|------|------|
| `Player` | 玩家出生点 | 读取 `x/y` 作为玩家初始位置(默认 240, 160) |
| `Enemy` | 敌人出生点 | 读取 `x/y` 创建 `Enemy` 实例 |
| `Container` | 宝箱 | 读取 `properties` 中"物品 ID → 数量"作为初始库存 |
| `Store` | 商店 NPC | `name` = 商店名;`properties` 中"物品 ID → 数量"作为商品 |
| `Bank` | 银行 NPC | `name` = NPC 名 |
| `camera` | 相机参数 | `properties` 数组中读取 `zoom`(默认 3) |
| `Door` | 传送门 | `properties` 读取 `target_scene`(目标地图 key) 和 `id`(目标 Spawn 的 id);玩家进入矩形区域后调用 `loadMap()` 切换地图,在目标地图查找匹配 id 的 `Spawn` 对象,找不到则抛错 |
| `Spawn` | 出生点 | `properties` 读取 `id`(任意字符串);Door 通过该 id 找到对应的 Spawn 进行传送 |

容器/商店的 properties 兼容三种格式:数组 `[{name, value}]`、对象 `{key: number}`、嵌套对象 `{key: {quantity: number}}`(Tiled 1.10+ 自定义类)。

---

## 11. 渲染与物理配置

### `src/main.ts` 关键配置

```typescript
render: {
    pixelArt: true,      // NEAREST 纹理过滤
    roundPixels: false   // 必须与相机同步关闭(pixelArt: true 默认会启用,需显式覆盖)
},
physics: {
    default: 'arcade',
    arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
        fixedStep: false   // 与渲染帧率同步,消除抖动
    }
}
```

### 像素比例策略

**禁止直接缩放精灵。** 统一像素比例通过相机 zoom 实现:

```typescript
this.cameras.main.setZoom(3);          // GameScene 从 Tiled camera 对象读取
this.cameras.main.roundPixels = false; // 必须与 render.roundPixels 同步
```

### 相机跟随

```typescript
this.cameras.main.startFollow(targetSprite, true, 0.1, 0.1);  // 线性插值 0.1 = 平滑延迟
```

### 高分辨率文本

`System.createText(x, y, content, style)` 已封装 `resolution: 3` 高分辨率渲染,避免像素字体放大模糊。所有 System 子类创建 `Text` 都应通过 `this.createText()`,不要直接 `scene.add.text()`。

---

## 12. Debug 工具

- **F9**: 切换物理碰撞器可视化 + solid 图层可见(`setAlpha(0.4)`) + 攻击判定框
- **GameScene.debugOverlay**: `Graphics`(depth 9999),用于绘制运行时调试图形

---

## 13. 常见陷阱与排查

### Phaser/资源相关

1. **"Cannot read properties of undefined (reading '2')" 在 tilemap 创建时**
   - 原因:Tiled JSON 中 tileset 是外部引用(`source: ".tsx"`)
   - 解决:重新导出 JSON,内嵌 tileset

2. **某图层不显示**
   - 原因:BootScene 没有预加载该地图使用的 tileset 图片
   - 解决:在 BootScene 的 `create()` 中为该 tileset name 添加 `this.load.image(name, path)`

3. **碰撞框偏移(紫色框在左上角)**
   - 原因:`super(scene, x, y, 'xxx')` 传入了动画 key 而非 texture key,Phaser 创建了 32x32 缺失纹理
   - 解决:第一个参数必须是 `images-map.json` 中定义的 spritesheet key(如 `'human_idle'`),而非动画 key(如 `'human_idle_right'`)

4. **角色移动抖动/残影**
   - 原因:`pixelArt: true` 自动启用 `roundPixels`,与浮点物理坐标 + 相机 zoom 冲突
   - 解决:`main.ts` 的 `render` 显式 `roundPixels: false`,GameScene 中 `cameras.main.roundPixels = false`,`physics.arcade.fixedStep: false`

5. **TS 报错 "Property 'setVelocity' does not exist on type 'Player'"**
   - 原因:`physics.add.existing()` 不会在类型层面扩展类
   - 解决:类型断言 `(sprite.body as Physics.Arcade.Body).setVelocity(...)`

### Electron / 路径相关

6. **生产模式资源 404(`file:///fonts/xxx.ttf`)**
   - 原因:使用了绝对路径 `/fonts/...`,在 `file://` 协议下解析到磁盘根
   - 解决:全部资源引用用相对路径(无前导 `/`),`vite.config.ts` 已设 `base: './'`

7. **`make.graphics` 报 "'add' does not exist in type 'Options'"**
   - 原因:Phaser 4 把 `add` 字段从 Options 中拆出
   - 解决:`make.graphics({ x, y }, false)` (第二个参数为 add 标志)

8. **`Text.TextStyle` 报 "is a type, but not a namespace"**
   - 原因:Phaser 4 中 `GameObjects.Text` 是类,`TextStyle` 已迁移到 `Types` 命名空间
   - 解决:使用 `Types.GameObjects.Text.TextStyle`

### TypeScript 严格模式

9. **TS6133 "declared but never read"**
   - 原因:未使用的 import / 字段 / 参数
   - 解决:删除未用项,**未使用参数加 `_` 前缀**(如 `_entities`)tsc 会放过

---

## 14. 修改 checklist

| 修改对象 | 必查项 |
|---------|--------|
| `MovementComponent.walkSpeed/runSpeed` | `AnimationSystem` 中的速度阈值判定 |
| 新增精灵表 | `images-map.json` 加条目,遵循 3 行 × N 列布局 |
| 新增/修改地图 | `maps-map.json` 加映射;Tiled JSON 中 tileset 已内嵌;BootScene 中预加载新 tileset 图片;图层名按需调整 |
| 修改物理体大小 | 实体构造函数中 `body.setSize(w, h)` 同步,匹配视觉尺寸 |
| 修改相机 zoom | 在 Tiled 的 `camera` 对象 `properties` 中调整 `zoom`,无需改代码 |
| 新增组件 | `Component.ts` 加类(纯数据);更新本文件 §8 的组件清单 |
| 新增系统 | 继承 `System`,加入 `GameScene.update()` **正确位置**(参考 §8 更新顺序);更新本文件 §4 项目结构 |
| 新增 Object Layer 类型 | `GameScene.create()` 中加 `obj.type === '...'` 分支;更新本文件 §10 |
| 新增地图 | `maps-map.json` 加映射;BootScene 会自动加载所有地图 JSON |
| 新增传送门(Door) | Tiled 中放置 Door 对象,配置 `target_scene` 和 `id`;目标地图中放置 `Spawn` 对象,`id` 与 Door 的 `id` 对应 |
| 新增 buff | `buffs-map.json` 加条目(id/name/description/effect.{type,value,interval},**不含 duration**);如需新增 effect 类型,在 `BuffSystem.applyBuffEffect` 中加 case;**给实体加 buff 只能通过 `buffComp.pendingBuffs.push({buffId, duration})`,duration 在附加时决定,同名 buff 自动累加持续时间,严禁直接调用 BuffSystem 方法** |
| 改 Electron 主进程行为 | 改 `electron/main.ts`,跑 `npm run build:electron`(dev 模式下 `dev:electron` 会自动重编) |
| 改打包行为 | 暂未集成 electron-builder。需要发行 `.exe` / `.dmg` 时再加 |

---

## 15. 最近 commit 历史(快速感知项目进度)

```
19c1344 修复源码中所有 TypeScript 严格模式错误     ← 当前 HEAD
2c4ec99 添加 Electron 桌面应用集成
1a44f12 删除claude工作树中的无效子项目
6442725 更新.gitignore,保留claude工作树路径
fd5091a 更新.gitignore,添加claude工作树路径
97ab2b9 忽略claude工作文件
270093f 添加银行功能
88ed5cf 添加快捷使用道具功能
07e0d43 应用角色的攻防属性,添加左上角详细ui显示
57d9d9e 修复字体模糊的问题
7364c70 添加商店
a499271 添加箱子
```

本地 main 比 `origin/main` 领先 2 个 commit(`19c1344` 和 `2c4ec99`),尚未 push。

---

## 16. 协作惯例

- **commit 信息用中文**,短描述风格(参照 §15)。需要 Co-Authored-By 时附上 Claude 的署名。
- **不要在 `.claude/worktrees/...` 临时目录工作**。所有操作直接在主目录 `D:\MyProjects\Phaser\FanhuaTales` 进行。
- **遇到 destructive git 操作**(`reset --hard` / `branch -D` / `worktree remove --force`),先确认用户意图。
- **改完代码先 `npm run build` 自检**,确保 tsc 0 error + vite 构建通过,再考虑 commit。
