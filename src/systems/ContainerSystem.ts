import { Scene, Input } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { SpriteComponent, ContainerComponent, UIStateComponent } from '../ecs/Component';

export class ContainerSystem extends System {
    private eKey!: Input.Keyboard.Key;
    private previousEDown = false;

    /** 交互距离（像素，世界坐标） */
    private readonly INTERACT_DISTANCE = 40;

    constructor(scene: Scene) {
        super(scene);
        this.eKey = scene.input.keyboard!.addKey('E');
    }

    update(entities: Entity[], _delta: number): void {
        const player = entities.find(e => e.hasComponent('player'));
        if (!player) return;

        const playerSprite = player.getComponent<SpriteComponent>('sprite')?.sprite;
        if (!playerSprite) return;

        const uistate = this.getUIState(entities);
        if (!uistate) return;

        // 找到距离最近的容器
        let nearestContainer: Entity | null = null;
        let nearestDist = Infinity;

        for (const entity of entities) {
            if (!entity.hasComponent('container')) continue;

            const containerSprite = entity.getComponent<SpriteComponent>('sprite')?.sprite;
            if (!containerSprite) continue;

            const dx = playerSprite.x - containerSprite.x;
            const dy = playerSprite.y - containerSprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < nearestDist) {
                nearestDist = dist;
                nearestContainer = entity;
            }
        }

        // 检测 E 键按下
        const eDown = this.eKey.isDown;
        if (eDown && !this.previousEDown && nearestContainer && nearestDist <= this.INTERACT_DISTANCE) {
            uistate.containerOpen = true;
            uistate.activeContainer = nearestContainer;
            uistate.inventoryOpen = true;
        }
        this.previousEDown = eDown;
    }

    private getUIState(entities: Entity[]): UIStateComponent | undefined {
        const entity = entities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<UIStateComponent>('uistate');
    }
}
