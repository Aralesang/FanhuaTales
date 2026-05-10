import { Scene, Input, GameObjects } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { FontConfig } from '../config/FontConfig';
import { SpriteComponent, ContainerComponent, UIStateComponent, VisualComponent } from '../ecs/Component';

export class ContainerSystem extends System {
    private eKey!: Input.Keyboard.Key;
    private previousEDown = false;

    /** 交互距离（像素，世界坐标） */
    private readonly INTERACT_DISTANCE = 40;

    // 交互提示
    private promptText!: GameObjects.Text;
    private promptBg!: GameObjects.Graphics;

    constructor(scene: Scene) {
        super(scene);
        this.eKey = scene.input.keyboard!.addKey('E');
        this.initPrompt();
    }

    private initPrompt(): void {
        this.promptBg = this.scene.add.graphics();
        this.promptBg.setDepth(200);
        this.promptBg.visible = false;

        this.promptText = this.createText(0, 0, '按 E 打开', {
            fontSize: FontConfig.small.size,
            color: '#ffffff',
            fontFamily: FontConfig.small.family,
        });
        this.promptText.setDepth(201);
        this.promptText.setOrigin(0.5, 1);
        this.promptText.visible = false;
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

        // 更新交互提示
        const canInteract = nearestContainer && nearestDist <= this.INTERACT_DISTANCE && !uistate.containerOpen;
        this.updatePrompt(nearestContainer, canInteract);

        // 检测 E 键按下
        const eDown = this.eKey.isDown;
        if (eDown && !this.previousEDown && canInteract) {
            uistate.containerOpen = true;
            uistate.activeContainer = nearestContainer;
            uistate.inventoryOpen = true;
        }
        this.previousEDown = eDown;
    }

    private updatePrompt(container: Entity | null, visible: boolean): void {
        if (!visible || !container) {
            this.promptBg.visible = false;
            this.promptText.visible = false;
            return;
        }

        const spriteComp = container.getComponent<SpriteComponent>('sprite');
        const visualComp = container.getComponent<VisualComponent>('visual');
        if (!spriteComp) return;

        const sprite = spriteComp.sprite;
        const visualH = visualComp?.height ?? sprite.height;

        const x = sprite.x;
        const y = sprite.y - visualH / 2 - 4;

        // 背景气泡（缩小为设计尺寸的一半）
        const promptScale = 0.5;
        const textW = this.promptText.width * promptScale;
        const textH = this.promptText.height * promptScale;
        const pad = 4 * promptScale;

        this.promptBg.clear();
        this.promptBg.fillStyle(0x1a1a2e, 0.9);
        this.promptBg.fillRoundedRect(
            x - textW / 2 - pad,
            y - textH - pad,
            textW + pad * 2,
            textH + pad * 2,
            4 * promptScale
        );
        this.promptBg.lineStyle(1, 0x444466, 1);
        this.promptBg.strokeRoundedRect(
            x - textW / 2 - pad,
            y - textH - pad,
            textW + pad * 2,
            textH + pad * 2,
            4 * promptScale
        );
        this.promptBg.visible = true;

        this.promptText.setPosition(x, y);
        this.promptText.setScale(promptScale);
        this.promptText.visible = true;
    }

    private getUIState(entities: Entity[]): UIStateComponent | undefined {
        const entity = entities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<UIStateComponent>('uistate');
    }
}
