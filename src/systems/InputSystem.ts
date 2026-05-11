import { Scene } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { InputComponent, MovementComponent, AttackComponent, UIStateComponent } from '../ecs/Component';

interface CursorPrevState {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
}

export class InputSystem extends System {
    private previousAttackDown: WeakMap<Entity, boolean> = new WeakMap();
    private previousCursorState: WeakMap<Entity, CursorPrevState> = new WeakMap();

    update(entities: Entity[], _delta: number): void {
        const uistate = this.getUIState(entities);

        for (const entity of entities) {
            if (!entity.hasComponent('input') || !entity.hasComponent('movement')) {
                continue;
            }

            const input = entity.getComponent<InputComponent>('input')!;
            const movement = entity.getComponent<MovementComponent>('movement')!;

            const hotbarDown = input.hotbarKey?.isDown ?? false;

            // 快捷栏模式：Ctrl 按住时屏蔽移动，方向键用于快捷栏
            if (hotbarDown) {
                movement.dx = 0;
                movement.dy = 0;
                movement.isRunning = false;

                if (uistate) {
                    uistate.hotbarOpen = true;

                    const prev = this.previousCursorState.get(entity) ?? {
                        up: false, down: false, left: false, right: false
                    };

                    // 方向键上升沿触发快捷栏使用
                    if (input.cursors.up.isDown && !prev.up) {
                        uistate.hotbarUseIndex = 0;
                    } else if (input.cursors.down.isDown && !prev.down) {
                        uistate.hotbarUseIndex = 1;
                    } else if (input.cursors.left.isDown && !prev.left) {
                        uistate.hotbarUseIndex = 2;
                    } else if (input.cursors.right.isDown && !prev.right) {
                        uistate.hotbarUseIndex = 3;
                    }
                }
            } else {
                // 正常移动模式
                let dx = 0;
                let dy = 0;

                if (input.cursors.up.isDown) {
                    dy -= 1;
                }
                if (input.cursors.down.isDown) {
                    dy += 1;
                }
                if (input.cursors.left.isDown) {
                    dx -= 1;
                }
                if (input.cursors.right.isDown) {
                    dx += 1;
                }

                // 归一化对角线移动
                if (dx !== 0 && dy !== 0) {
                    const length = Math.sqrt(dx * dx + dy * dy);
                    dx /= length;
                    dy /= length;
                }

                movement.dx = dx;
                movement.dy = dy;
                movement.isRunning = input.shiftKey.isDown;

                if (uistate) {
                    uistate.hotbarOpen = false;
                }
            }

            // 记录当前光标状态
            this.previousCursorState.set(entity, {
                up: input.cursors.up.isDown,
                down: input.cursors.down.isDown,
                left: input.cursors.left.isDown,
                right: input.cursors.right.isDown,
            });

            // 攻击输入：检测按键上升沿，写入 AttackComponent
            if (entity.hasComponent('attack')) {
                const attack = entity.getComponent<AttackComponent>('attack')!;
                const prevDown = this.previousAttackDown.get(entity) ?? false;
                const isDown = input.attackKey.isDown;

                if (isDown && !prevDown) {
                    attack.isAttacking = true;
                }

                this.previousAttackDown.set(entity, isDown);
            }
        }
    }

    private getUIState(entities: Entity[]): UIStateComponent | undefined {
        const entity = entities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<UIStateComponent>('uistate');
    }
}
