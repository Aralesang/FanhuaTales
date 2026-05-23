import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { InputComponent, MovementComponent, AttackComponent, UIStateComponent } from '../ecs/Component';

export class InputSystem extends System {
    private previousAttackDown: WeakMap<Entity, boolean> = new WeakMap();

    update(entities: Entity[], _delta: number): void {
        const uistate = this.getUIState(entities);

        // 调试控制台打开时，跳过所有游戏输入处理
        if (uistate?.debugConsoleOpen) {
            return;
        }

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

            // 攻击输入：检测鼠标左键上升沿（无 UI 打开且鼠标不在快捷栏上），写入 AttackComponent
            if (entity.hasComponent('attack')) {
                const isAnyUIOpen = uistate?.inventoryOpen || uistate?.containerOpen || uistate?.storeOpen || uistate?.bankOpen;
                const inHotbar = uistate?.pointerInHotbar ?? false;
                const attack = entity.getComponent<AttackComponent>('attack')!;
                const prevDown = this.previousAttackDown.get(entity) ?? false;
                const isDown = pointer.leftButtonDown();

                if (!isAnyUIOpen && !inHotbar && isDown && !prevDown) {
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
