# FanhuaTales Copilot Workspace Instructions

## Session Bootstrap
- At the beginning of each new chat session in this workspace, read and use [SESSION_CONTEXT.md](../SESSION_CONTEXT.md) as the primary project context before proposing code changes.
- If [SESSION_CONTEXT.md](../SESSION_CONTEXT.md) conflicts with code, trust the code and then update [SESSION_CONTEXT.md](../SESSION_CONTEXT.md).

## Required Documentation Maintenance
- Keep [SESSION_CONTEXT.md](../SESSION_CONTEXT.md) synchronized when changes are significant.
- Significant changes include:
  - Core architecture changes (ECS boundaries, system responsibilities, data flow)
  - Scene/map pipeline changes (scene registration, tiled factories, teleport rules)
  - Directory structure changes (core module additions, renames, major moves)
  - Input/resource/tagging contract changes (keys, asset loading flow, entity tags)
  - Gameplay loop changes (combat, AI, inventory, item usage)

## Development Constraints
- Prefer ECS style: entity for composition, component for data, system for behavior.
- Component purity rule: components must contain data only, and may expose at most simple setters/getters. Do not place gameplay logic, side effects, timers, or orchestration in components.
- Entity purity rule: entities must not contain gameplay logic or persistent business data. Entities are assembly shells only (attach components, tags, collision shape, visual wiring).
- System-only logic rule: all runtime gameplay logic must be implemented in systems. Avoid calling behavior by obtaining system instances and invoking imperative methods from entities/components.
- Data-driven interaction rule: trigger behaviors through component data flags/state, and let systems process them in update polling. Example: item usage must be represented as a use-request component state, then consumed by ItemUseSystem in update.
- Reuse central systems instead of duplicating logic (for example, route damage through DamageSystem).
- Preserve existing folder naming conventions used by the repository (including `entitys`).

## Working Style
- For medium/large tasks, update [SESSION_CONTEXT.md](../SESSION_CONTEXT.md) in the same change set if any significant behavior or architecture changed.
- Keep updates concise and factual; avoid stale TODOs in the context document.
- When generating or modifying code for this project, add detailed Chinese comments where they improve readability, especially around non-trivial logic, data flow, and system interactions.
