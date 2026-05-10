import { Scene, Input, GameObjects } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { SpriteComponent, StoreComponent, UIStateComponent, VisualComponent } from '../ecs/Component';

export class StoreSystem extends System {
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

        this.promptText = this.scene.add.text(0, 0, '按 E 交易', {
            fontSize: '12px',
            color: '#ffffff',
            fontFamily: 'VonwaonBitmap12',
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

        // 找到距离最近的商店
        let nearestStore: Entity | null = null;
        let nearestDist = Infinity;

        for (const entity of entities) {
            if (!entity.hasComponent('store')) continue;

            const storeSprite = entity.getComponent<SpriteComponent>('sprite')?.sprite;
            if (!storeSprite) continue;

            const dx = playerSprite.x - storeSprite.x;
            const dy = playerSprite.y - storeSprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < nearestDist) {
                nearestDist = dist;
                nearestStore = entity;
            }
        }

        // 更新交互提示
        const canInteract = nearestStore && nearestDist <= this.INTERACT_DISTANCE && !uistate.storeOpen && !uistate.containerOpen;
        this.updatePrompt(nearestStore, canInteract);

        // 检测 E 键按下
        const eDown = this.eKey.isDown;
        if (eDown && !this.previousEDown && canInteract) {
            uistate.storeOpen = true;
            uistate.activeStore = nearestStore;
        }
        this.previousEDown = eDown;
    }

    private updatePrompt(store: Entity | null, visible: boolean): void {
        if (!visible || !store) {
            this.promptBg.visible = false;
            this.promptText.visible = false;
            return;
        }

        const spriteComp = store.getComponent<SpriteComponent>('sprite');
        const visualComp = store.getComponent<VisualComponent>('visual');
        if (!spriteComp) return;

        const sprite = spriteComp.sprite;
        const visualH = visualComp?.height ?? sprite.height;
        const promptScale = 0.5;

        const x = sprite.x;
        const y = sprite.y - visualH / 2 - 4;

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
