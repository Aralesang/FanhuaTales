import { Scene, GameObjects, Physics } from 'phaser';
import { Component, SpriteComponent, BodyConfigComponent } from './Component';

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

    /**
     * 添加 BodyConfigComponent 并立即把配置写入 sprite 的 Arcade Body。
     * 要求实体此前已经 addComponent(SpriteComponent)，且 sprite 已通过
     * scene.physics.add.existing(sprite) 创建了 body。
     *
     * @param width   body 宽度（像素）
     * @param height  body 高度（像素）
     * @param offsetX body 相对 sprite 左上角的 X 偏移
     * @param offsetY body 相对 sprite 左上角的 Y 偏移
     */
    protected applyBodyConfig(width: number, height: number, offsetX: number, offsetY: number): BodyConfigComponent {
        const config = new BodyConfigComponent(width, height, offsetX, offsetY);
        this.addComponent(config);

        const sprite = this.getComponent<SpriteComponent>('sprite')?.sprite;
        const body = sprite?.body as Physics.Arcade.Body | undefined;
        if (body) {
            body.setSize(width, height, false);
            body.setOffset(offsetX, offsetY);
        }
        return config;
    }
}
