import * as ex from 'excalibur';
import { GridContainerComponent } from '../components/grid-container-component';
import { ItemBase } from '../item-base';
import { GridContainerSystem } from '../systems/grid-container-system';
import { InventoryPane } from './inventory-pane';

export type GridPaneBinding<TPane extends string> = {
    id: TPane;
    pane: InventoryPane;
    getContainer: () => GridContainerComponent | null;
};

type HoverContext<TPane extends string> = {
    item: ItemBase | null;
    paneId: TPane | null;
    localPos: ex.Vector;
};

type RightClickContext<TPane extends string> = {
    item: ItemBase;
    paneId: TPane;
    event: ex.PointerEvent;
};

type GridDragControllerOptions<TPane extends string> = {
    host: ex.Actor;
    panes: GridPaneBinding<TPane>[];
    dragZ: number;
    onHover?: (ctx: HoverContext<TPane>) => void;
    onRightClick?: (ctx: RightClickContext<TPane>) => void;
    onChanged?: () => void;
};

type HitResult<TPane extends string> = {
    item: ItemBase;
    paneId: TPane;
};

/**
 * 通用网格拖拽控制器：
 * - 统一处理单容器/多容器的拖拽流程（按下、拖动、放下）
 * - 统一处理同容器内重排与跨容器转移
 * - UI 层只需提供 pane 绑定与少量回调（悬停、右键使用、刷新）
 */
export class GridDragController<TPane extends string> {
    private readonly host: ex.Actor;
    private readonly panes: GridPaneBinding<TPane>[];
    private readonly dragZ: number;
    private readonly onHover?: (ctx: HoverContext<TPane>) => void;
    private readonly onRightClick?: (ctx: RightClickContext<TPane>) => void;
    private readonly onChanged?: () => void;

    private draggedItem: ItemBase | null = null;
    private draggedActor: ex.Actor | null = null;
    private dragOffset: ex.Vector = ex.Vector.Zero;
    private dragSourcePaneId: TPane | null = null;

    constructor(options: GridDragControllerOptions<TPane>) {
        this.host = options.host;
        this.panes = options.panes;
        this.dragZ = options.dragZ;
        this.onHover = options.onHover;
        this.onRightClick = options.onRightClick;
        this.onChanged = options.onChanged;
    }

    public handlePointerDown(event: ex.PointerEvent, localPos: ex.Vector) {
        const hit = this.findItemAt(localPos);
        if (!hit) {
            return;
        }

        const isRightClick = (event.button as any) === ex.PointerButton.Right || (event.button as any) === 'Right';
        if (isRightClick) {
            this.onRightClick?.({ item: hit.item, paneId: hit.paneId, event });
            return;
        }

        this.startDrag(hit.item, hit.paneId, localPos);
    }

    public handlePointerMove(localPos: ex.Vector) {
        if (this.draggedActor) {
            this.draggedActor.pos = localPos.sub(this.dragOffset);
            return;
        }

        if (!this.onHover) {
            return;
        }

        const hit = this.findItemAt(localPos);
        this.onHover({
            item: hit?.item ?? null,
            paneId: hit?.paneId ?? null,
            localPos
        });
    }

    public handlePointerUp(localPos: ex.Vector) {
        if (!this.draggedItem || !this.dragSourcePaneId) {
            return;
        }

        const sourceBinding = this.getPaneBinding(this.dragSourcePaneId);
        const sourceContainer = sourceBinding?.getContainer() ?? null;
        let handled = false;

        if (sourceBinding && sourceContainer) {
            const targetBinding = this.getPaneAt(localPos);
            if (targetBinding) {
                const targetContainer = targetBinding.getContainer();
                if (targetContainer) {
                    if (targetBinding.id === this.dragSourcePaneId) {
                        const gridX = targetBinding.pane.getGridX(localPos);
                        const gridY = targetBinding.pane.getGridY(localPos);
                        if (GridContainerSystem.isGridPositionFree(targetContainer, gridX, gridY, this.draggedItem.width, this.draggedItem.height)) {
                            GridContainerSystem.placeItem(targetContainer, this.draggedItem.uid, gridX, gridY);
                            handled = true;
                        }
                    } else if (GridContainerSystem.transferItem(sourceContainer, targetContainer, this.draggedItem.uid)) {
                        handled = true;
                    }
                }
            }

            if (!handled) {
                GridContainerSystem.placeItemOnGrid(sourceContainer, this.draggedItem);
            }
        }

        this.reset(true);
        this.onChanged?.();
    }

    public reset(removeDraggedActor: boolean = true) {
        if (removeDraggedActor && this.draggedActor) {
            this.host.removeChild(this.draggedActor);
        }

        this.draggedActor = null;
        this.draggedItem = null;
        this.dragSourcePaneId = null;
        this.dragOffset = ex.Vector.Zero;
    }

    public isDragging(): boolean {
        return !!this.draggedActor;
    }

    private startDrag(item: ItemBase, paneId: TPane, mousePos: ex.Vector) {
        const binding = this.getPaneBinding(paneId);
        const sourceContainer = binding?.getContainer() ?? null;
        if (!binding || !sourceContainer) {
            return;
        }

        this.draggedItem = item;
        this.dragSourcePaneId = paneId;

        const itemAnchor = binding.pane.getItemAnchor(item);
        this.draggedActor = new ex.Actor({
            pos: itemAnchor,
            width: binding.pane.getItemPixelWidth(item),
            height: binding.pane.getItemPixelHeight(item),
            z: this.dragZ
        });

        this.draggedActor.graphics.use(new ex.Rectangle({
            width: binding.pane.getItemPixelWidth(item),
            height: binding.pane.getItemPixelHeight(item),
            color: binding.pane.getItemColor(item),
            strokeColor: ex.Color.White,
            lineWidth: 2
        }));

        this.dragOffset = mousePos.sub(this.draggedActor.pos);
        this.host.addChild(this.draggedActor);

        // 进入拖拽时先释放源容器占用，便于后续进行落点检测。
        GridContainerSystem.removeItemFromGrid(sourceContainer, item);
    }

    private findItemAt(localPos: ex.Vector): HitResult<TPane> | null {
        for (const paneBinding of this.panes) {
            const item = paneBinding.pane.findItemAt(localPos);
            if (item) {
                return {
                    item,
                    paneId: paneBinding.id
                };
            }
        }

        return null;
    }

    private getPaneAt(localPos: ex.Vector): GridPaneBinding<TPane> | null {
        for (const paneBinding of this.panes) {
            if (paneBinding.pane.isPointInside(localPos)) {
                return paneBinding;
            }
        }

        return null;
    }

    private getPaneBinding(paneId: TPane): GridPaneBinding<TPane> | null {
        for (const paneBinding of this.panes) {
            if (paneBinding.id === paneId) {
                return paneBinding;
            }
        }

        return null;
    }
}