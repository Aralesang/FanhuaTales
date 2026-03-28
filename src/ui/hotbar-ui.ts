import * as ex from 'excalibur';
import { HotbarComponent } from '../components/hotbar-component';
import { InventoryPane } from './inventory-pane';

/**
 * 底部快捷栏 UI（只读展示版）：
 * - 当前阶段仅负责显示玩家 Hotbar 容器内容
 * - 交互（点击释放/拖拽交换）将在后续阶段接入统一拖拽控制器
 */
export class HotbarUI extends ex.ScreenElement {
    private readonly player: ex.Actor;
    private readonly pane: InventoryPane;
    private hotbar: HotbarComponent | null = null;

    constructor(player: ex.Actor) {
        const slotSize = 40;
        const slotMargin = 4;
        const width = 8 * (slotSize + slotMargin) - slotMargin + 24;
        const height = slotSize + 42;

        super({
            x: 400,
            y: 568,
            width,
            height,
            anchor: ex.Vector.Half,
            z: 1020
        });

        this.player = player;

        const background = new ex.Rectangle({
            width,
            height,
            color: ex.Color.fromHex('#101010cc'),
            strokeColor: ex.Color.fromHex('#b8a98d'),
            lineWidth: 1
        });
        this.graphics.use(background);

        this.pane = new InventoryPane({
            title: '快捷栏',
            startX: -width / 2 + 12,
            startY: -10,
            headerY: -26,
            slotSize,
            slotMargin,
            gridWidth: 8,
            gridHeight: 1,
            zBase: 1021,
            style: InventoryPane.createStyle({
                slotColor: ex.Color.fromHex('#3b3b3b'),
                slotStrokeColor: ex.Color.fromHex('#d0c0a4')
            })
        });
        this.pane.attachTo(this);
    }

    override onPostUpdate(_engine: ex.Engine, _delta: number): void {
        if (!this.hotbar) {
            this.hotbar = this.player.get(HotbarComponent) as HotbarComponent | null;
        }

        if (!this.hotbar) {
            return;
        }

        this.pane.setContainer(this.hotbar);
        this.pane.render();
    }
}