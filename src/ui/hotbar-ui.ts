import * as ex from 'excalibur';
import { HotbarComponent } from '../components/hotbar-component';
import { InventoryPane } from './inventory-pane';
import { getSharedInventoryDragManager } from './inventory-drag-manager';
import { HoverTooltip } from './hover-tooltip';
import { ItemBase } from '../item-base';
import { ItemUseRequestComponent } from '../components/item-use-request-component';

/**
 * 底部快捷栏 UI
 */
export class HotbarUI extends ex.ScreenElement {
    private readonly player: ex.Actor;
    private readonly pane: InventoryPane;
    private hotbar: HotbarComponent | null = null;

    //共享拖拽管理器
    private dragManager: ReturnType<typeof getSharedInventoryDragManager> | null = null;
    //防止重复注册
    private paneRegistered: boolean = false;
    private readonly hoverTooltip: HoverTooltip;

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
            title: '',
            startX: -width / 2 + 12,
            startY: -20,
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
        this.hoverTooltip = new HoverTooltip({
            width: 240,
            height: 74,
            textOffsetX: 12,
            textOffsetY: 11,
        });
        this.hoverTooltip.attachTo(this);
    }

    override onPostUpdate(_engine: ex.Engine, _delta: number): void {
        if (!this.hotbar) {
            this.hotbar = this.player.get(HotbarComponent) as HotbarComponent | null;
        }

        if (!this.hotbar) {
            return;
        }

        //注册拖拽管理器
        if (!this.paneRegistered) {
            this.registerPane(_engine);
        }
        this.pane.setContainer(this.hotbar);
        this.pane.render();
    }

    private updateDispaly() {
        if (!this.hotbar) {
            return;
        }

        this.pane.setContainer(this.hotbar);
        this.pane.render();
    }

    private registerPane(engine: ex.Engine) {
        if (!this.hotbar) {
            return;
        }

        this.dragManager = getSharedInventoryDragManager(engine);

        this.dragManager.registerPane({
            id: "hotbar-main",
            pane: this.pane,
            getContainer: () => this.hotbar,
            //与InventoryUI之类的一致：ScreenElement 坐标系转换
            screenToLocal: (screenPos) => screenPos.sub(this.pos),
            localToScreen: (localPos) => this.pos.add(localPos),
            onChanged: () => {
                //拖拽后刷新显示
                this.updateDispaly();
            },
            // 快捷栏常驻显示，直接返回
            isActive: () => true,
             onHover: (ctx) => {
                if (!ctx.item) {
                    this.hideHover();
                    return;
                }

                this.showHover(ctx.item, ctx.localPos);
            },
            onRightClick: (ctx) => {
                const item = ctx.item;
                if (!item.usable) {
                    console.log(`${item.name} 不能使用`);
                    (ctx.event as any).preventDefault?.();
                    return;
                }

                // 直接设置 ItemUseRequestComponent，由 ItemUseSystem 处理效果
                let requestComp = this.player.get(ItemUseRequestComponent);
                if (!requestComp) {
                    requestComp = new ItemUseRequestComponent();
                    this.player.addComponent(requestComp);
                }

                // 如果已有未处理的请求，跳过
                if (requestComp.itemToUse !== null && !requestComp.processed) {
                    console.log(`已有待处理的物品使用请求，跳过: ${item.name}`);
                    (ctx.event as any).preventDefault?.();
                    return;
                }

                requestComp.itemToUse = item;
                requestComp.user = this.player;
                requestComp.target = null;
                requestComp.requestTime = Date.now();
                requestComp.processed = false;
                requestComp.success = false;
                requestComp.clearFlag = false;

                console.log(`快捷栏标记道具使用请求：${item.name}`);
                (ctx.event as any).preventDefault?.();
                this.updateDispaly();
            },
        });

        this.paneRegistered = true;
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
}