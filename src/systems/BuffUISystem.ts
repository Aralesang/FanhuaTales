import { Scene, GameObjects } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { FontConfig } from '../config/FontConfig';
import {
    BuffComponent, BuffDefinition, SettingsComponent
} from '../ecs/Component';

interface BuffRect {
    x: number;
    y: number;
    size: number;
    buffId: string;
}

/**
 * Buff UI 系统：屏幕右上角显示玩家当前生效的 buff。
 * - 每个 buff 一块色块（按 effect.type 默认着色，暂无图标）
 * - 色块右下角显示剩余秒数；永久 buff 不显示数字
 * - 鼠标 hover 色块时显示 buff 名称 + 描述 tooltip
 *
 * 严格 ECS：只读取 BuffComponent.buffs，不调用 BuffSystem 的任何方法。
 */
export class BuffUISystem extends System {
    private slotGraphics!: GameObjects.Graphics;
    private durationTexts: GameObjects.Text[] = [];

    // 当前帧每个 buff 色块的世界坐标矩形，用于 hover 命中
    private buffRects: BuffRect[] = [];

    // Tooltip
    private tooltipPanel!: GameObjects.Graphics;
    private tooltipName!: GameObjects.Text;
    private tooltipDesc!: GameObjects.Text;

    private buffsMap!: Record<string, BuffDefinition>;

    private readonly BASE_SIZE = 16;
    private readonly BASE_GAP = 4;
    private readonly BASE_MARGIN = 8;

    private uiScale = 1.0;

    constructor(scene: Scene) {
        super(scene);
        this.buffsMap = scene.cache.json.get('buffsMap') as Record<string, BuffDefinition>;
        this.initUI();
    }

    private initUI(): void {
        // 色块层级 65：高于快捷栏（60-64），低于 tooltip（10000）
        this.slotGraphics = this.scene.add.graphics();
        this.slotGraphics.setDepth(65);

        // Tooltip
        this.tooltipPanel = this.scene.add.graphics();
        this.tooltipPanel.setDepth(10000);
        this.tooltipPanel.visible = false;

        this.tooltipName = this.createText(0, 0, '', {
            fontSize: FontConfig.large.size,
            color: '#ffffff',
            fontFamily: FontConfig.large.family,
        });
        this.tooltipName.setDepth(10001);
        this.tooltipName.setOrigin(0, 0);
        this.tooltipName.visible = false;

        this.tooltipDesc = this.createText(0, 0, '', {
            fontSize: FontConfig.small.size,
            color: '#cccccc',
            fontFamily: FontConfig.small.family,
        });
        this.tooltipDesc.setDepth(10001);
        this.tooltipDesc.setOrigin(0, 0);
        this.tooltipDesc.visible = false;
    }

    update(entities: Entity[], _delta: number): void {
        // 读取 UI 缩放
        const settingsEntity = entities.find(e => e.hasComponent('settings'));
        const settings = settingsEntity?.getComponent<SettingsComponent>('settings');
        this.uiScale = settings?.uiScale ?? 1.0;

        const player = entities.find(e => e.hasComponent('player'));
        const buffComp = player?.getComponent<BuffComponent>('buff');
        if (!buffComp || buffComp.buffs.length === 0) {
            this.hideAll();
            return;
        }

        this.renderBuffs(buffComp);
        this.renderTooltip();
    }

    private renderBuffs(buffComp: BuffComponent): void {
        const scale = this.uiScale;
        const size = this.BASE_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const margin = this.BASE_MARGIN * scale;

        // 屏幕右上角在世界坐标系中的位置
        const cam = this.scene.cameras.main;
        const zoom = cam.zoom || 1;
        const viewRight = cam.midPoint.x + cam.width / 2 / zoom;
        const viewTop = cam.midPoint.y - cam.height / 2 / zoom;
        const baseY = viewTop + margin;

        // 隐藏所有 duration 文字，按需重新启用
        for (const text of this.durationTexts) {
            text.visible = false;
        }

        this.buffRects = [];
        this.slotGraphics.clear();
        this.slotGraphics.visible = true;

        // 从右往左排列
        for (let i = 0; i < buffComp.buffs.length; i++) {
            const instance = buffComp.buffs[i];
            const def = this.buffsMap?.[instance.buffId];
            if (!def) continue;

            const x = viewRight - margin - (i + 1) * size - i * gap;
            const y = baseY;

            this.buffRects.push({ x, y, size, buffId: instance.buffId });

            // 色块（带边框）
            this.slotGraphics.fillStyle(this.getBuffColor(def), 1);
            this.slotGraphics.fillRect(x, y, size, size);
            this.slotGraphics.lineStyle(Math.max(1, scale), 0x1a1a2e, 1);
            this.slotGraphics.strokeRect(x, y, size, size);

            // 剩余秒数（永久 buff = -1 时不显示）
            if (instance.remainingDuration > 0) {
                const seconds = Math.ceil(instance.remainingDuration / 1000);
                const text = this.acquireDurationText(i);
                text.setPosition(x + size - 1 * scale, y + size - 1 * scale);
                text.setScale(scale);
                text.setText(String(seconds));
                text.visible = true;
            }
        }
    }

    private acquireDurationText(idx: number): GameObjects.Text {
        if (idx < this.durationTexts.length) {
            return this.durationTexts[idx];
        }
        const text = this.createText(0, 0, '', {
            fontSize: FontConfig.small.size,
            color: '#ffffff',
            fontFamily: FontConfig.small.family,
        });
        text.setDepth(66);
        text.setOrigin(1, 1);
        this.durationTexts.push(text);
        return text;
    }

    private renderTooltip(): void {
        const pointer = this.scene.input.activePointer;
        const cam = this.scene.cameras.main;
        const world = cam.getWorldPoint(pointer.x, pointer.y);

        // hover 检测
        let hoveredBuffId: string | null = null;
        for (const rect of this.buffRects) {
            if (
                world.x >= rect.x && world.x < rect.x + rect.size &&
                world.y >= rect.y && world.y < rect.y + rect.size
            ) {
                hoveredBuffId = rect.buffId;
                break;
            }
        }

        if (!hoveredBuffId) {
            this.hideTooltip();
            return;
        }

        const def = this.buffsMap?.[hoveredBuffId];
        if (!def) {
            this.hideTooltip();
            return;
        }

        const scale = this.uiScale;
        const pad = 8 * scale;
        const nameLineH = 18 * scale;
        const bodyLineH = 14 * scale;
        const nameFontSize = 16 * scale;
        const bodyFontSize = 12 * scale;

        const nameText = def.name;
        const descText = def.description;

        // 简单估算文本宽度（位图字体字符宽度 ≈ fontSize）
        const maxTextW = Math.max(
            nameText.length * nameFontSize,
            descText.length * bodyFontSize
        );
        const tooltipW = Math.max(maxTextW + pad * 2, 140 * scale);
        const tooltipH = nameLineH + bodyLineH + pad * 2;

        // tooltip 默认显示在鼠标左下方（buff 在右上角）
        const zoom = cam.zoom || 1;
        const viewLeft = cam.midPoint.x - cam.width / 2 / zoom;
        const viewBottom = cam.midPoint.y + cam.height / 2 / zoom;

        let tx = world.x - tooltipW - 8 * scale;
        let ty = world.y + 8 * scale;
        if (tx < viewLeft) {
            tx = world.x + 8 * scale;   // 撞到左边则改放右下
        }
        if (ty + tooltipH > viewBottom) {
            ty = world.y - tooltipH - 8 * scale;
        }

        this.tooltipPanel.clear();
        this.tooltipPanel.fillStyle(0x0a0a18, 1);
        this.tooltipPanel.fillRoundedRect(tx, ty, tooltipW, tooltipH, 4 * scale);
        this.tooltipPanel.lineStyle(Math.max(1, scale), 0x444466, 1);
        this.tooltipPanel.strokeRoundedRect(tx, ty, tooltipW, tooltipH, 4 * scale);
        this.tooltipPanel.visible = true;

        this.tooltipName.setPosition(tx + pad, ty + pad);
        this.tooltipName.setScale(scale);
        this.tooltipName.setText(nameText);
        this.tooltipName.visible = true;

        this.tooltipDesc.setPosition(tx + pad, ty + pad + nameLineH);
        this.tooltipDesc.setScale(scale);
        this.tooltipDesc.setText(descText);
        this.tooltipDesc.visible = true;
    }

    private hideTooltip(): void {
        this.tooltipPanel.visible = false;
        this.tooltipName.visible = false;
        this.tooltipDesc.visible = false;
    }

    private hideAll(): void {
        this.slotGraphics.visible = false;
        for (const text of this.durationTexts) {
            text.visible = false;
        }
        this.buffRects = [];
        this.hideTooltip();
    }

    /** buff 暂无图标，根据 effect.type 给一个默认色块色 */
    private getBuffColor(def: BuffDefinition): number {
        switch (def.effect.type) {
            case 'heal_over_time': return 0x44cc44;
            case 'damage_over_time': return 0xcc3333;
            default: return 0xaaaaaa;
        }
    }
}
