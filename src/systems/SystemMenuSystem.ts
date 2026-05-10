import { Scene, GameObjects, Input } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { FontConfig } from '../config/FontConfig';
import { SettingsComponent, UIStateComponent } from '../ecs/Component';

export class SystemMenuSystem extends System {
    private isOpen = false;
    private previousEscDown = false;
    private escKey!: Input.Keyboard.Key;

    // UI 元素
    private bg!: GameObjects.Graphics;
    private panel!: GameObjects.Graphics;
    private titleText!: GameObjects.Text;
    private labelText!: GameObjects.Text;
    private valueText!: GameObjects.Text;
    private sliderTrack!: GameObjects.Graphics;
    private sliderThumb!: GameObjects.Graphics;

    // 滑块交互状态
    private isDragging = false;
    private wasPointerDown = false;
    private readonly sliderMin = 0.5;
    private readonly sliderMax = 2.0;

    // 滑块当前几何（世界坐标，每帧更新）
    private sliderX = 0;
    private sliderY = 0;
    private sliderW = 0;
    private thumbSize = 0;

    // 面板基础尺寸
    private readonly BASE_PANEL_W = 320;
    private readonly BASE_PANEL_H = 200;

    constructor(scene: Scene) {
        super(scene);
        this.escKey = scene.input.keyboard!.addKey(Input.Keyboard.KeyCodes.ESC);
        this.initUI();
    }

    private initUI(): void {
        // 全屏半透明遮罩
        this.bg = this.scene.add.graphics();
        this.bg.setDepth(20000);
        this.bg.visible = false;

        // 菜单面板
        this.panel = this.scene.add.graphics();
        this.panel.setDepth(20001);
        this.panel.visible = false;

        // 标题：系统菜单（使用位图字体设计尺寸 16px，通过 setScale 缩放）
        this.titleText = this.createText(0, 0, '系统菜单', {
            fontSize: FontConfig.large.size,
            color: '#ffffff',
            fontFamily: FontConfig.large.family,
        });
        this.titleText.setDepth(20002);
        this.titleText.setOrigin(0.5, 0);
        this.titleText.visible = false;

        // 标签：UI 大小（使用位图字体设计尺寸 12px，通过 setScale 缩放）
        this.labelText = this.createText(0, 0, 'UI 大小', {
            fontSize: FontConfig.small.size,
            color: '#cccccc',
            fontFamily: FontConfig.small.family,
        });
        this.labelText.setDepth(20002);
        this.labelText.setOrigin(0, 0.5);
        this.labelText.visible = false;

        // 数值百分比
        this.valueText = this.createText(0, 0, '100%', {
            fontSize: FontConfig.small.size,
            color: '#ffffff',
            fontFamily: FontConfig.small.family,
        });
        this.valueText.setDepth(20002);
        this.valueText.setOrigin(0, 0.5);
        this.valueText.visible = false;

        // 滑块轨道
        this.sliderTrack = this.scene.add.graphics();
        this.sliderTrack.setDepth(20002);
        this.sliderTrack.visible = false;

        // 滑块按钮
        this.sliderThumb = this.scene.add.graphics();
        this.sliderThumb.setDepth(20003);
        this.sliderThumb.visible = false;
    }

    update(entities: Entity[], _delta: number): void {
        const uistate = this.getUIState(entities);
        const escDown = this.escKey.isDown;

        if (escDown && !this.previousEscDown) {
            // ESC 逻辑：如果有任何 UI 打开，优先关闭全部；否则切换系统菜单
            if (uistate?.inventoryOpen || uistate?.containerOpen || uistate?.storeOpen) {
                uistate.inventoryOpen = false;
                uistate.containerOpen = false;
                uistate.storeOpen = false;
                uistate.activeContainer = null;
                uistate.activeStore = null;
                this.isOpen = false;
            } else {
                this.isOpen = !this.isOpen;
            }
        }
        this.previousEscDown = escDown;

        if (!this.isOpen) {
            this.hideAll();
            this.isDragging = false;
            this.wasPointerDown = false;
            return;
        }

        const settings = this.getSettings(entities);
        const scale = settings?.uiScale ?? 1.0;

        this.renderMenu(scale);
        this.handleSliderInput(scale, settings);
    }

    private getUIState(entities: Entity[]): UIStateComponent | undefined {
        const entity = entities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<UIStateComponent>('uistate');
    }

    private getSettings(entities: Entity[]): SettingsComponent | undefined {
        const entity = entities.find(e => e.hasComponent('settings'));
        return entity?.getComponent<SettingsComponent>('settings');
    }

    private renderMenu(scale: number): void {
        const cam = this.scene.cameras.main;
        const cx = cam.midPoint.x;
        const cy = cam.midPoint.y;

        const panelW = this.BASE_PANEL_W * scale;
        const panelH = this.BASE_PANEL_H * scale;
        const px = cx - panelW / 2;
        const py = cy - panelH / 2;

        // 全屏半透明遮罩
        this.bg.clear();
        this.bg.fillStyle(0x000000, 0.6);
        const camW = cam.width / (cam.zoom || 1);
        const camH = cam.height / (cam.zoom || 1);
        this.bg.fillRect(cx - camW / 2, cy - camH / 2, camW, camH);
        this.bg.visible = true;

        // 面板背景 + 边框
        this.panel.clear();
        this.panel.fillStyle(0x1a1a2e, 0.95);
        this.panel.fillRoundedRect(px, py, panelW, panelH, 8 * scale);
        this.panel.lineStyle(2, 0x444466, 1);
        this.panel.strokeRoundedRect(px, py, panelW, panelH, 8 * scale);
        this.panel.visible = true;

        // 标题
        this.titleText.setPosition(cx, py + 16 * scale);
        this.titleText.setScale(scale);
        this.titleText.visible = true;

        // 设置项 Y 坐标
        const itemY = py + 80 * scale;
        const labelX = px + 24 * scale;

        // UI 大小标签
        this.labelText.setPosition(labelX, itemY);
        this.labelText.setScale(scale);
        this.labelText.visible = true;

        // 滑块几何
        this.sliderX = labelX + 70 * scale;
        this.sliderY = itemY;
        this.sliderW = Math.max(60, 140 * scale);
        this.thumbSize = Math.max(8, 16 * scale);

        const sliderH = Math.max(4, 10 * scale);
        const fillRatio = (scale - this.sliderMin) / (this.sliderMax - this.sliderMin);

        // 滑块轨道（背景 + 已填充）
        this.sliderTrack.clear();
        this.sliderTrack.fillStyle(0x333344, 1);
        this.sliderTrack.fillRoundedRect(
            this.sliderX,
            this.sliderY - sliderH / 2,
            this.sliderW,
            sliderH,
            sliderH / 2
        );
        this.sliderTrack.fillStyle(0x4488cc, 1);
        this.sliderTrack.fillRoundedRect(
            this.sliderX,
            this.sliderY - sliderH / 2,
            this.sliderW * Math.max(0, Math.min(1, fillRatio)),
            sliderH,
            sliderH / 2
        );
        this.sliderTrack.visible = true;

        // 滑块按钮
        const thumbX = this.sliderX + this.sliderW * Math.max(0, Math.min(1, fillRatio));
        this.sliderThumb.clear();
        this.sliderThumb.fillStyle(0xffffff, 1);
        this.sliderThumb.fillCircle(thumbX, this.sliderY, this.thumbSize / 2);
        this.sliderThumb.lineStyle(2, 0x4488cc, 1);
        this.sliderThumb.strokeCircle(thumbX, this.sliderY, this.thumbSize / 2);
        this.sliderThumb.visible = true;

        // 数值文本
        this.valueText.setPosition(this.sliderX + this.sliderW + 10 * scale, itemY);
        this.valueText.setScale(scale);
        this.valueText.setText(`${Math.round(scale * 100)}%`);
        this.valueText.visible = true;
    }

    private handleSliderInput(currentScale: number, settings: SettingsComponent | undefined): void {
        const pointer = this.scene.input.activePointer;

        if (pointer.isDown) {
            const { x: worldX, y: worldY } = this.screenToWorld(pointer.x, pointer.y);

            if (!this.wasPointerDown) {
                // 首次按下，检测是否点在滑块区域
                if (this.isInSliderArea(worldX, worldY)) {
                    this.isDragging = true;
                }
            }

            if (this.isDragging) {
                let ratio = (worldX - this.sliderX) / this.sliderW;
                ratio = Math.max(0, Math.min(1, ratio));
                const newScale = this.sliderMin + ratio * (this.sliderMax - this.sliderMin);
                if (settings) {
                    settings.uiScale = Math.round(newScale * 20) / 20; // 步进 0.05
                }
            }
        } else {
            this.isDragging = false;
        }

        this.wasPointerDown = pointer.isDown;
    }

    private isInSliderArea(worldX: number, worldY: number): boolean {
        return (
            worldX >= this.sliderX - this.thumbSize &&
            worldX <= this.sliderX + this.sliderW + this.thumbSize &&
            worldY >= this.sliderY - this.thumbSize &&
            worldY <= this.sliderY + this.thumbSize
        );
    }

    private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
        const cam = this.scene.cameras.main;
        const worldPoint = cam.getWorldPoint(screenX, screenY);
        return { x: worldPoint.x, y: worldPoint.y };
    }

    private hideAll(): void {
        this.bg.visible = false;
        this.panel.visible = false;
        this.titleText.visible = false;
        this.labelText.visible = false;
        this.valueText.visible = false;
        this.sliderTrack.visible = false;
        this.sliderThumb.visible = false;
    }
}
