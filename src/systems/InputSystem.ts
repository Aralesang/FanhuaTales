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
        const pointer = this.scene.input.activePointer;
        const cam = this.scene.cameras.main;

        for (const entity of entities) {
            if (!entity.hasComponent('input') || !entity.hasComponent('movement')) {
                continue;
            }

            const input = entity.getComponent<InputComponent>('input')!;
            const movement = entity.getComponent<MovementComponent>('movement')!;

            // 更新鼠标世界坐标
            const worldPoint = cam.getWorldPoint(pointer.x, pointer.y);
            input.mouseX = worldPoint.x;
            input.mouseY = worldPoint.y;

            const hotbarDown = input.hotbarKey?.isDown ?? false;

            // 移动（WASD）
            let dx = 0;
            let dy = 0;

            if (input.upKey.isDown) {
                dy -= 1;
            }
            if (input.downKey.isDown) {
                dy += 1;
            }
            if (input.leftKey.isDown) {
                dx -= 1;
            }
            if (input.rightKey.isDown) {
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

            // 快捷栏（Ctrl + 方向键）
            if (uistate) {
                uistate.hotbarOpen = hotbarDown;

                if (hotbarDown) {
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
            }

            // 记录当前光标状态
            this.previousCursorState.set(entity, {
                up: input.cursors.up.isDown,
                down: input.cursors.down.isDown,
                left: input.cursors.left.isDown,
                right: input.cursors.right.isDown,
            });

            // 攻击输入：检测鼠标左键上升沿（无 UI 打开时），写入 AttackComponent
            if (entity.hasComponent('attack')) {
                const isAnyUIOpen = uistate?.inventoryOpen || uistate?.containerOpen || uistate?.storeOpen || uistate?.bankOpen;
                const attack = entity.getComponent<AttackComponent>('attack')!;
                const prevDown = this.previousAttackDown.get(entity) ?? false;
                const isDown = pointer.leftButtonDown();

                if (!isAnyUIOpen && isDown && !prevDown) {
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
