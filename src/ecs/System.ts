import { Scene, GameObjects } from 'phaser';
import { Entity } from './Entity';

export abstract class System {
    protected scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    abstract update(entities: Entity[], delta: number): void;

    /**
     * 创建高分辨率文本对象，避免像素风字体模糊。
     * 通过提高内部 canvas 的 resolution（默认 3x）来匹配相机 zoom，
     * 使位图字体在放大后保持清晰边缘。
     */
    protected createText(
        x: number,
        y: number,
        content: string,
        style: Partial<GameObjects.Text.TextStyle> = {}
    ): GameObjects.Text {
        return this.scene.add.text(x, y, content, {
            ...style,
            resolution: 3
        } as GameObjects.Text.TextStyle);
    }
}
