# FanhuaTales — ECS 重构总结

## 重构概述
项目已从混合架构重构为严格遵循 ECS（Entity-Component-System）架构的实现。所有逻辑从实体和组件中移出，集中到系统中，确保实体仅作为组件容器，组件仅存储数据，系统处理所有行为。

## 新架构结构

### 实体（Entitys）
- **Player**: 纯容器，仅在 `onInitialize` 中添加组件。不包含任何逻辑。
- **Enemy**: 纯容器，仅添加组件。移除 `onPreUpdate` 中的 AI 逻辑和碰撞处理。

### 组件（Components）
- **AIComponent**: 新增纯数据组件，存储 AI 参数（速度、追逐半径、攻击冷却等）。
- **HealthComponent**: 简化，移除 `takeDamage` 方法，仅保留 HP 数据和眩晕状态。
- **AnimationComponent**: 保留辅助方法（数据管理）。
- **DirectionComponent**: 纯数据。
- **PlayerControlComponent**: 纯数据。
- **StateMachineComponent**: 保持状态机创建。

### 系统（Systems）
- **AISystem**: 新增，处理敌人 AI 逻辑（追踪玩家、移动、状态切换）。查询玩家实体，无需全局变量。
- **DamageSystem**: 新增，处理伤害应用、音效、闪烁、击退和眩晕逻辑。提供 `applyDamage` 方法供外部调用。
- **AnimationSystem**: 更新方向变化。
- **PlayerControlSystem**: 处理输入和移动。
- **StateMachineSystem**: 更新状态机。
- **DirectionSystem**: 目前为空，可扩展。

### 场景（Scenes）
- **Village**: 添加 `AISystem` 和 `DamageSystem`。移除全局 `Global.localPlayer`，通过查询获取玩家。设置碰撞处理器处理敌人攻击玩家。
- **SwordState**: 修改为使用 `DamageSystem.applyDamage` 而非直接调用组件方法。

## 主要变化
1. **逻辑迁移**:
   - 敌人 AI 从 `Enemy.onPreUpdate` 移至 `AISystem`。
   - 伤害逻辑从 `HealthComponent.takeDamage` 移至 `DamageSystem.applyDamage`。
   - 碰撞处理从实体事件移至场景的碰撞监听器。

2. **数据纯化**:
   - 组件仅存储数据，无方法（除辅助方法）。
   - 实体无逻辑，仅初始化组件。

3. **依赖移除**:
   - 移除 `Global.localPlayer`，系统通过查询获取实体。
   - 避免全局状态，提高可测试性。

## 优势
- **可维护性**: 逻辑集中，易于修改和扩展。
- **可测试性**: 系统独立，可单元测试。
- **性能**: 查询优化，逻辑解耦。
- **扩展性**: 新功能通过添加组件和系统实现，无需修改现有实体。

## 运行验证
重构后，游戏功能保持不变：
- 玩家控制、移动、攻击正常。
- 敌人 AI、追踪、攻击正常。
- 伤害反馈（音效、闪烁、击退）正常。
- 编译无错误。

## 未来扩展建议
- 添加更多 AI 类型：创建新组件（如 `FlyingAIComponent`），对应新系统。
- 战斗系统扩展：添加 `BuffSystem` 处理状态效果。
- 事件系统：使用 ECS 事件而非直接调用。