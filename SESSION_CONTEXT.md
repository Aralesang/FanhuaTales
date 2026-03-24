# FanhuaTales 会话预加载说明

此文档用于在每次开发会话开始时快速恢复项目上下文。若项目发生关键变化，请同步更新本文件。

## 1. 项目定位

FanhuaTales 是一个基于 Excalibur 的 2D 像素风原型项目，当前聚焦于：

- Tiled 地图驱动的场景切换
- ECS（Entity-Component-System）组织玩法逻辑
- 玩家移动、攻击、敌人 AI、伤害结算
- 物品掉落/拾取/背包/使用的基础闭环

技术栈：

- TypeScript
- Excalibur 0.31.0
- @excaliburjs/plugin-tiled 0.31.0
- Vite 6

## 2. 主要功能（当前状态）

- 场景与地图
  - `village` 与 `interior` 场景可切换。
  - 地图与对象由 Tiled 资源加载，门（Door）对象触发跨场景传送。

- 玩家与战斗
  - 玩家支持 8 向移动（方向优先级由按键栈控制）。
  - 攻击键为 `X`，当前默认技能是 `Sword`。
  - 伤害由 `DamageSystem` 统一处理（扣血、击退、眩晕、闪烁、死亡移除）。

- 敌人与 AI
  - 敌人为 ECS 组装体（方向、状态机、动画、生命、技能等组件）。
  - `AISystem` 负责敌人行为更新。

- 物品与背包
  - 地图中可生成物品实体，玩家靠近后由 `PickupSystem` 拾取。
  - `InventorySystem` 管理库存数据。
  - 场景中的箱子拥有独立库存，玩家靠近后按 `E` 打开双栏仓库界面，可在玩家背包与箱子之间双向转移物品。
  - `ItemUseSystem` 处理使用请求，支持治疗/伤害等效果分发。
  - `I` 键开关库存 UI。

- 资源与配置
  - `public/data/*.json` 管理图片、地图、音效、物品配置映射。
  - 启动时由 `Asset.init()` 统一加载。

## 3. 架构说明（ECS）

项目采用 ECS 分层思想：

- Entity：实体容器（如 `Player`、`Enemy`、`Item`）。
- Component：状态数据（如方向、生命、技能、库存、输入意图）。
- System：行为逻辑（如控制、动画、状态机、AI、伤害、拾取、物品使用）。

当前实践约定：

- 实体中允许保留“组装逻辑”（在 `onInitialize` 添加组件、设置碰撞/标签）。
- 运行期行为优先放在 System，避免把玩法逻辑散落到实体内部。
- 组件尽量保持“数据为主”，减少跨层副作用。
- Component 必须是纯数据，不允许放业务逻辑；最多允许简单 set/get。
- Entity 只做组件组装，不承载业务逻辑与业务数据。
- 所有运行期逻辑必须在 System 中处理，不允许通过获取 System 实例并直接调用方法来驱动玩法。
- 交互必须数据驱动：通过组件标记/状态触发，再由 System 在 update 轮询处理（例如道具使用通过请求组件标记触发）。

## 4. 目录结构（核心）

```text
src/
  main.ts                 # 引擎入口、场景注册、资源加载、开局场景
  asset.ts                # 图片/地图/音效/物品配置加载与访问
  components/             # ECS 组件（数据）
  entitys/                # ECS 实体（组装容器）
  systems/                # ECS 系统（主要业务逻辑）
  states/                 # 状态机状态
  scenes/                 # 场景与场景初始化
  skills/                 # 技能定义
  ui/                     # HUD/库存等界面
  events/                 # 事件定义（动画/状态机等）
  test/                   # 测试与实验代码

public/
  data/                   # images-map / maps-map / sounds-map / items-map
  maps/                   # Tiled 地图与 tileset
  images/                 # 美术资源
  sounds/                 # 音效
  music/                  # 音乐
```

## 5. 开发注意事项

- 场景新增或改名时，需要同时检查：
  - `src/main.ts` 的场景注册表
  - `public/data/maps-map.json` 的地图映射
  - `src/scenes/*` 中门对象的 `target_scene` 配置

- 地图对象工厂命名需与 Tiled 对象类型一致（如 `player-start`、`enemy-start`）。

- 关键标签约定：
  - 玩家：`player`
  - 敌人：`enemy`
  - 物品：`item`
  依赖标签的系统/触发器改动时，要同步检查相关过滤逻辑。

- `DamageSystem` 是伤害统一入口。新增攻击/受击逻辑时，优先复用它，不要在多个位置重复写扣血与死亡处理。

- 箱子交互由 `ChestSystem` 处理；箱子作为带 `InventoryComponent` 的实体存在，物品转移复用 `InventorySystem` 的库存操作。

- 严禁“命令式跨层调用”替代 ECS 流程：
  - 推荐：写入组件请求数据 -> System 轮询并消费 -> 回写结果数据。
  - 不推荐：实体/组件直接获取某个 System 并调用行为方法。

- `Asset.playMusic(name)` 当前从 `sounds` 字典按名字读取。请确保 `sounds-map.json` 中存在对应 key（当前默认 `time_for_adventure`）。

- `src/entitys` 目录名拼写为 `entitys`（非 `entities`），请保持一致，避免导入路径错误。

- 代码中存在较多 `console.log` 调试输出；发布前建议集中清理或降级为可控日志。

## 6. 本文档维护规则（重要）

当出现以下任一情况时，应更新本文件：

- 新增/删除核心系统（如战斗、AI、背包、状态机链路变化）
- 场景结构或地图配置机制发生变化
- 目录结构发生明显调整（新增顶层模块、重命名核心目录）
- 输入映射、资源加载流程、关键标签约定被修改
- 对外开发约束变化（例如“伤害统一入口”从 `DamageSystem` 迁移）

建议最少在以下时机检查更新：

- 每次完成一个中等以上功能（影响多个文件/模块）
- 每次完成架构重构

---

最后更新：2026-03-25
