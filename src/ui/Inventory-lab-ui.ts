import * as ex from 'excalibur';
import { GridContainerComponent } from '../components/grid-container-component';
import { ItemBase } from '../item-base';
import { HoverTooltip } from './hover-tooltip';
import { getSharedInventoryDragManager } from './inventory-drag-manager';
import { InventoryPane } from './inventory-pane';

export class InventoryLabUI extends ex.ScreenElement {
    private opened: boolean = false;
    private readonly background: ex.Rectangle;
    private readonly hint: ex.Label;
    private readonly pane: InventoryPane;
    private readonly hoverTooltip: HoverTooltip;
    private readonly dragManager: ReturnType<typeof getSharedInventoryDragManager>;
    private readonly labContainer: GridContainerComponent;

    private readonly SLOT_SIZE = 44;
    private readonly SLOT_MARGIN = 4;
    private readonly GRID_COLS = 8;
    private readonly GRID_ROWS = 5;
    private readonly GRID_START_X = -190;
    private readonly GRID_START_Y = -100;
    private readonly HEADER_Y = -128;

    constructor(engine: ex.Engine) {
        super({
            x: 400,
            y: 300,
            width: 560,
            height: 360,
            anchor: ex.Vector.Half,
            z: 1000
        });

        this.dragManager = getSharedInventoryDragManager(engine);
        this.labContainer = new GridContainerComponent({
            kind: 'generic',
            gridWidth: this.GRID_COLS,
            gridHeight: this.GRID_ROWS,
            allowRotate: true
        });

        this.background = new ex.Rectangle({
            width: 560,
            height: 360,
            color: ex.Color.fromHex('#10212dcc'),
            strokeColor: ex.Color.fromHex('#8ed8ff'),
            lineWidth: 2
        });

        this.hint = new ex.Label({
            text: '可从任意已打开库存拖入这里',
            pos: ex.vec(0, 150),
            z: 1001,
            font: new ex.Font({
                family: 'Arial',
                size: 18,
                color: ex.Color.fromHex('#8ed8ff'),
                textAlign: ex.TextAlign.Center
            })
        });

        this.pane = new InventoryPane({
            title: '实验容器',
            startX: this.GRID_START_X,
            startY: this.GRID_START_Y,
            headerY: this.HEADER_Y,
            slotSize: this.SLOT_SIZE,
            slotMargin: this.SLOT_MARGIN,
            gridWidth: this.GRID_COLS,
            gridHeight: this.GRID_ROWS,
            zBase: 1000,
            style: InventoryPane.createStyle({
                slotColor: ex.Color.fromHex('#2a3c4a'),
                slotStrokeColor: ex.Color.fromHex('#9ed8ff')
            })
        });
        this.pane.attachTo(this);

        this.hoverTooltip = new HoverTooltip({
            width: 240,
            height: 74,
            textOffsetX: 12,
            textOffsetY: 11,
        });
        this.hoverTooltip.attachTo(this);

        this.graphics.hide();
    }

    public isOpen() {
        return this.opened;
    }

    public show() {
        this.opened = true;
        this.graphics.use(this.background);

        if (!this.children.includes(this.hint)) {
            this.addChild(this.hint);
        }

        this.registerPane();
        this.updateDisplay();
    }

    public hide() {
        this.opened = false;
        this.hideHover();
        this.dragManager.unregisterPane('inventory-lab');
        this.graphics.hide();
        this.removeChild(this.hint);
        this.pane.clear();
    }

    public toggle() {
        if (this.opened) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 每帧后更新：当实验容器界面可见时，自动刷新面板渲染。
     * InventoryPane 内部有 renderKey 优化，只有数据真正变化时才会执行重绘。
     */
    override onPostUpdate(_engine: ex.Engine, _delta: number): void {
        if (this.opened) {
            this.updateDisplay();
        }
    }

    private showHover(item: ItemBase, localPos: ex.Vector) {
        this.hoverTooltip.show(
            `${item.name}\n${item.description}\n数量: ${item.quantity}`,
            localPos,
            ex.vec(128, 64)
        );
    }

    private hideHover() {
        this.hoverTooltip.hide();
    }

    private updateDisplay() {
        if (!this.opened) {
            return;
        }

        this.pane.setContainer(this.labContainer);
        this.pane.render();
    }

    private registerPane() {
        this.dragManager.registerPane({
            id: 'inventory-lab',
            pane: this.pane,
            getContainer: () => this.labContainer,
            screenToLocal: (screenPos) => screenPos.sub(this.pos),
            localToScreen: (localPos) => this.pos.add(localPos),
            onHover: (ctx) => {
                if (!ctx.item) {
                    this.hideHover();
                    return;
                }

                this.showHover(ctx.item, ctx.localPos);
            },
            onChanged: () => {
                this.updateDisplay();
            },
            isActive: () => this.opened
        });
    }
}