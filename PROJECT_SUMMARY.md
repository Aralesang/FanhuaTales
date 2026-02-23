# FanhuaTales — 项目摘要

此文档为工程快速上手与当前实现状态的概要，便于在新会话中继续开发。

## 项目概览
- 项目路径: 根目录
- 引擎: Excalibur (v0.31.0)
- 地图插件: @excaliburjs/plugin-tiled

## 目录结构（高层）
- `index.html`, `package.json`, `README.md`
- `src/` — 源代码
  - `asset.ts` — 资源/贴图与 tilemap 注册
  - `main.ts` — 程序入口
  - `base-scene.ts` — 场景基类
  - `global.ts` — 全局引用（例如 `localPlayer`）
  - `components/` — 组件（`animation-component.ts`, `state-machine-component.ts`, `direction-component.ts`, `health-component.ts` 等）
  - `entitys/` — 实体（`player.ts`, `enemy.ts`）
  - `systems/` — 系统（`animation-system.ts`, `player-control-system.ts`, `state-machine-system.ts`, `tile-map-system.ts` 等）
  - `states/` — 状态（`idle-state.ts`, `walk-state.ts`, `sword-state.ts` 等）
  - `scenes/` — 场景（`village.ts`, `interior.ts`, `test-map.ts`）

## 主要功能与实现要点
- 玩家：`src/entitys/player.ts`
  - 使用 `DirectionComponent`, `StateMachineComponent`, `AnimationComponent`, 可选 `PlayerControlComponent`。
  - 贴图通过 `AnimationComponent('human', actor)` 使用 `Asset.imageMap` 中定义的 `human_*` 贴图。

- 敌人（临时实现）：`src/entitys/enemy.ts`
  - 复用玩家贴图与状态机，挂载 `HealthComponent`（默认 3 HP）。
  - 简单 AI：靠近玩家时以固定速度追踪；AI 会尊重眩晕（`__stunUntil`）并在眩晕期间停止行动。
  - 已在 `src/scenes/village.ts` 中注册了 `enemy-start` 的 tiled factory，并在玩家生成后在其右侧生成一个测试敌人。

- 动画与状态机
  - `StateMachineComponent` 将状态机描述绑定到Actor，状态包括 `Initial|Idle|Walk|Run|Sword`。
  - `AnimationComponent` 根据 `entityType` + 动作名 + 方向拼接 image key（例如 `human_idle`）并播放对应帧。

- 战斗系统（当前实现）
  - 攻击触发：玩家按键触发 `SwordState`（`src/states/sword-state.ts`），在进入 `Sword` 状态时播放 `sword` 动画，并在动画的命中窗口创建临时判定区域（Trigger）和立即重叠检测来确保命中可靠。
  - 伤害处理：新增 `HealthComponent`（`src/components/health-component.ts`），支持 `takeDamage(amount, opts)`，并可接受额外参数来实现击退（knockback）、眩晕（stunMs）与闪烁视觉（flashMs/flashTimes）。
  - 命中时会调用 `HealthComponent.takeDamage(1, { source, knockback, stunMs, flashMs, flashTimes })`，从而触发闪烁与击退效果。

  ## 音频
  - 背景音乐：放置在 `public/music` 下，当前项目包含 `time_for_adventure.mp3`，会在游戏启动后作为循环背景音乐播放。代码入口：`Asset.music`，通过 `Asset.playMusic()` 启动。
  - 音效：放置在 `public/sounds` 下（示例文件：`coin.wav`, `explosion.wav`, `hurt.wav`, `jump.wav`, `power_up.wav`, `tap.wav`）。已在 `src/asset.ts` 中注册为 `Asset.sounds`，可通过 `Asset.playSound('coin')` 之类调用。

## 新增 / 修改的文件列表
- 新增：`src/entitys/enemy.ts` — 敌人实体
- 新增：`src/components/health-component.ts` — 生命值与受击反馈
- 新增：`tools/screenshot.js` — 可选的本地自动截图脚本（使用 Playwright），非必需
- 修改：`src/scenes/village.ts` — 注册 `enemy-start` factory、生成测试敌人
- 修改：`src/states/sword-state.ts` — 添加命中判定逻辑、触发伤害调用
- 修改：`src/entitys/player.ts` — 挂载 `HealthComponent`（玩家默认 5 HP）

（如需查看变更细节，可在代码管理工具中查看这些文件的 diff）

## 运行与调试
1. 安装依赖：
```bash
npm install
```
2. 启动开发服务器：
```bash
npm start
```
默认 vite 会在 `http://localhost:5173/` 提供服务。

3. 场景测试
  - 打开浏览器访问 `http://localhost:5173/`，进入 `Village` 场景。
  - 玩家由 `tilemap` 中 `player-start` 工厂创建并设置为 `Global.localPlayer`。
  - 敌人将在玩家右侧自动生成（用于快速验证）。
  - 按 `X` 发起攻击，观察控制台日志：
    - 应看到 `[Attack] trigger.action -> ...` 或 `[Attack] immediate-overlap hit:` 等日志。
    - 敌人被命中应闪烁、被击退并在 HP <= 0 时消失。

4. 常见调试点
  - 若命中无效：查看控制台日志，确认 `SwordState` 中的命中窗口与 `attackTrigger` 是否打印日志。
  - 若闪烁看不见：确认 `GraphicsComponent.opacity` 是否被更改（部分渲染器可能需要 `actor.graphics.opacity`）。
  - 可调整命中窗口和数值：`src/states/sword-state.ts` 中的 `hitWindowStart/Duration/width/height`，以及 `takeDamage` 中传入的 `knockback/stunMs/flashMs`。

## 下一步建议（可选优先级）
1. 抽象 `AttackComponent`：把判定、伤害、击退、特效等封装成可复用组件，便于敌人和玩家共享。 (推荐)
2. 增加受击粒子与音效：在 `HealthComponent.takeDamage` 触发视觉/音效反馈。
3. 敌人行为：实现巡逻、发现玩家的视野/听觉、攻击反击逻辑。
4. UI：添加玩家/敌人血条与伤害数值浮动显示。
5. 单元测试或集成测试：为核心系统（状态机、受击、碰撞）添加自动化测试。

## 备注
- 本仓库包含一个辅助脚本 `tools/screenshot.js`（基于 Playwright）用于在本地自动化截屏；运行此脚本前需要 `npx playwright install chromium`。
- 如果你在新会话继续开发，推荐先从 `PROJECT_SUMMARY.md` 中的“下一步建议”选择一项并把该项作为新 issue/任务开始。

---
文件位置： [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)
