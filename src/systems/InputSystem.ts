import { Scene } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { InputComponent, MovementComponent, AttackComponent } from '../ecs/Component';

export class InputSystem extends System {
    private previousAttackDown: WeakMap<Entity, boolean> = new WeakMap();

    update(entities: Entity[], _delta: number): void {
        for (const entity of entities) {
            if (!entity.hasComponent('input') || !entity.hasComponent('movement')) {
                continue;
            }

            const input = entity.getComponent<InputComponent>('input')!;
            const movement = entity.getComponent<MovementComponent>('movement')!;

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
}
