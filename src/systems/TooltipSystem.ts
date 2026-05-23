import { Scene, GameObjects } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { FontConfig } from '../config/FontConfig';
import { TooltipData, SettingsComponent } from '../ecs/Component';

/**
 * 统一 Tooltip 系统。
 *
 * 职责：集中管理所有 UI 的 tooltip 渲染。
 * 其他 UI 系统检测到 hover 时，将 `TooltipData` 写入 `UIStateComponent.tooltip`；
 * 本系统在每帧末尾统一读取并渲染，避免各系统重复创建 tooltip 对象。
 */
export class TooltipSystem extends System {
    private panel!: GameObjects.Graphics;
    private nameText!: GameObjects.Text;
    private typeText!: GameObjects.Text;
    private descText!: GameObjects.Text;
    private statsText!: GameObjects.Text;

    constructor(scene: Scene) {
        super(scene);
        this.initUI();
    }

    private initUI(): void {
        this.panel = this.scene.add.graphics();
        this.panel.setDepth(10000);
        this.panel.visible = false;

        this.nameText = this.createText(0, 0, '', {
            fontSize: FontConfig.large.size,
            color: '#ffffff',
            fontFamily: FontConfig.large.family,
        });
        this.nameText.setDepth(10001);
        this.nameText.setOrigin(0, 0);
        this.nameText.visible = false;

        this.typeText = this.createText(0, 0, '', {
            fontSize: FontConfig.small.size,
            color: '#aaaaaa',
            fontFamily: FontConfig.small.family,
        });
        this.typeText.setDepth(10001);
        this.typeText.setOrigin(0, 0);
        this.typeText.visible = false;

        this.descText = this.createText(0, 0, '', {
            fontSize: FontConfig.small.size,
            color: '#cccccc',
            fontFamily: FontConfig.small.family,
        });
        this.descText.setDepth(10001);
        this.descText.setOrigin(0, 0);
        this.descText.visible = false;

        this.statsText = this.createText(0, 0, '', {
            fontSize: FontConfig.small.size,
            color: '#88cc88',
            fontFamily: FontConfig.small.family,
        });
        this.statsText.setDepth(10001);
        this.statsText.setOrigin(0, 0);
        this.statsText.visible = false;
    }

    update(entities: Entity[], _delta: number): void {
        const settingsEntity = entities.find(e => e.hasComponent('settings'));
        const settings = settingsEntity?.getComponent<SettingsComponent>('settings');
        const scale = settings?.uiScale ?? 1.0;

        const uistate = this.getUIState(entities);
        const data = uistate?.tooltip ?? null;

        // 消费掉请求，避免下一帧重复显示
        if (uistate) {
            uistate.tooltip = null;
        }

        if (!data) {
            this.hideAll();
            return;
        }

        this.render(data, scale);
    }

    private render(data: TooltipData, scale: number): void {
        const pad = 8 * scale;
        const nameLineH = 18 * scale;
        const bodyLineH = 14 * scale;
        const nameFontSize = 16 * scale;
        const bodyFontSize = 12 * scale;

        const hasType = !!data.typeText;
        const hasDesc = !!data.description;
        const hasStats = !!data.stats;

        // 测量文本宽度
        let maxTextW = data.name.length * nameFontSize;
        if (hasType) {
            maxTextW = Math.max(maxTextW, data.typeText!.length * bodyFontSize);
        }
        if (hasDesc) {
            maxTextW = Math.max(maxTextW, data.description!.length * bodyFontSize);
        }
        if (hasStats) {
            maxTextW = Math.max(maxTextW, data.stats!.length * bodyFontSize);
        }

        const tooltipW = Math.max(maxTextW + pad * 2, 140 * scale);

        // 计算高度
        let lineCount = 1; // name
        if (hasType) lineCount++;
        if (hasDesc) lineCount++;
        if (hasStats) lineCount++;
        const tooltipH = nameLineH + bodyLineH * (lineCount - 1) + pad * 2;

        // 边界检查：默认右下方，超出则翻转
        let tx = data.x + 16 * scale;
        let ty = data.y + 16 * scale;
        const cam = this.scene.cameras.main;
        const camRight = cam.midPoint.x + (cam.width / 2 / (cam.zoom || 1));
        const camBottom = cam.midPoint.y + (cam.height / 2 / (cam.zoom || 1));
        if (tx + tooltipW > camRight) {
            tx = data.x - tooltipW - 8 * scale;
        }
        if (ty + tooltipH > camBottom) {
            ty = data.y - tooltipH - 8 * scale;
        }

        // 绘制背景
        this.panel.clear();
        this.panel.fillStyle(0x0a0a18, 1);
        this.panel.fillRoundedRect(tx, ty, tooltipW, tooltipH, 4 * scale);
        this.panel.lineStyle(Math.max(1, scale), 0x444466, 1);
        this.panel.strokeRoundedRect(tx, ty, tooltipW, tooltipH, 4 * scale);
        this.panel.visible = true;

        // 名称
        this.nameText.setPosition(tx + pad, ty + pad);
        this.nameText.setScale(scale);
        this.nameText.setText(data.name);
        this.nameText.setColor(data.nameColor);
        this.nameText.visible = true;

        let currentY = ty + pad + nameLineH;

        // 类型
        if (hasType) {
            this.typeText.setPosition(tx + pad, currentY);
            this.typeText.setScale(scale);
            this.typeText.setText(`[${data.typeText}]`);
            this.typeText.visible = true;
            currentY += bodyLineH;
        } else {
            this.typeText.visible = false;
        }

        // 描述
        if (hasDesc) {
            this.descText.setPosition(tx + pad, currentY);
            this.descText.setScale(scale);
            this.descText.setText(data.description!);
            this.descText.visible = true;
            currentY += bodyLineH;
        } else {
            this.descText.visible = false;
        }

        // 额外信息
        if (hasStats) {
            this.statsText.setPosition(tx + pad, currentY);
            this.statsText.setScale(scale);
            this.statsText.setText(data.stats!);
            this.statsText.setColor(data.statsColor ?? '#88cc88');
            this.statsText.visible = true;
        } else {
            this.statsText.visible = false;
        }
    }

    private hideAll(): void {
        this.panel.visible = false;
        this.nameText.visible = false;
        this.typeText.visible = false;
        this.descText.visible = false;
        this.statsText.visible = false;
    }

    private getUIState(entities: Entity[]): import('../ecs/Component').UIStateComponent | undefined {
        const entity = entities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<import('../ecs/Component').UIStateComponent>('uistate');
    }
}
