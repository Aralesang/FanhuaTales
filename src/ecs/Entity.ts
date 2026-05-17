import { Scene, GameObjects } from 'phaser';
import { Component, SpriteComponent } from './Component';

export class Entity {
    scene: Scene;
    active: boolean = true;
    private components: Map<string, Component> = new Map();

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /** 快捷获取精灵引用。实体被销毁后返回 undefined，防止访问已销毁的 sprite。 */
    get sprite(): GameObjects.Sprite | undefined {
        if (!this.active) return undefined;
        return this.getComponent<SpriteComponent>('sprite')?.sprite;
    }

    destroy(): void {
        const s = this.sprite;
        if (s) {
            s.destroy();
        }
        this.active = false;
    }

    addComponent(component: Component): void {
        this.components.set(component.type, component);
    }

    getComponent<T extends Component>(type: string): T | undefined {
        return this.components.get(type) as T | undefined;
    }

    hasComponent(type: string): boolean {
        return this.components.has(type);
    }

    removeComponent(type: string): void {
        this.components.delete(type);
    }
}
