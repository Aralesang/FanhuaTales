import * as ex from 'excalibur';
import { GridContainerComponent } from '../components/grid-container-component';
import { ItemBase } from '../item-base';
import { GridContainerSystem } from '../systems/grid-container-system';
import { InventoryPane } from './inventory-pane';

type HoverContext = {
    item: ItemBase | null;
    paneId: string | null;
    localPos: ex.Vector;
    screenPos: ex.Vector;
};

type RightClickContext = {
    item: ItemBase;
    paneId: string;
    localPos: ex.Vector;
    screenPos: ex.Vector;
    event: ex.PointerEvent;
};

export type GridPaneRegistration = {
    id: string;
    pane: InventoryPane;
    getContainer: () => GridContainerComponent | null;
    screenToLocal: (screenPos: ex.Vector) => ex.Vector;
    localToScreen: (localPos: ex.Vector) => ex.Vector;
    onHover?: (ctx: HoverContext) => void;
    onRightClick?: (ctx: RightClickContext) => void;
    onChanged?: () => void;
    isActive?: () => boolean;
};

type HitResult = {
    binding: GridPaneRegistration;
    item: ItemBase;
    localPos: ex.Vector;
};

class InventoryDragManager {
    private readonly engine: ex.Engine;
    private readonly overlay: ex.ScreenElement;
    private readonly bindings = new Map<string, GridPaneRegistration>();
    private bindingOrder: string[] = [];

    private draggedItem: ItemBase | null = null;
    private draggedActor: ex.Actor | null = null;
    private dragOffset: ex.Vector = ex.Vector.Zero;
    private dragSourcePaneId: string | null = null;
    private hoverPaneId: string | null = null;

    private readonly onPointerDownBound: (event: ex.PointerEvent) => void;
    private readonly onPointerMoveBound: (event: ex.PointerEvent) => void;
    private readonly onPointerUpBound: (event: ex.PointerEvent) => void;

    constructor(engine: ex.Engine) {
        this.engine = engine;
        this.overlay = new ex.ScreenElement({
            x: 0,
            y: 0,
            anchor: ex.vec(0, 0),
            z: 10000
        });

        this.engine.add(this.overlay);

        this.onPointerDownBound = (event) => this.handlePointerDown(event);
        this.onPointerMoveBound = (event) => this.handlePointerMove(event);
        this.onPointerUpBound = (event) => this.handlePointerUp(event);

        this.engine.input.pointers.on('down', this.onPointerDownBound);
        this.engine.input.pointers.on('move', this.onPointerMoveBound);
        this.engine.input.pointers.on('up', this.onPointerUpBound);
    }

    public dispose() {
        this.cancelDrag(false);
        this.clearHover();
        this.engine.input.pointers.off('down', this.onPointerDownBound);
        this.engine.input.pointers.off('move', this.onPointerMoveBound);
        this.engine.input.pointers.off('up', this.onPointerUpBound);
        this.bindings.clear();
        this.bindingOrder = [];
        this.overlay.kill();
    }

    public registerPane(binding: GridPaneRegistration) {
        this.bindings.set(binding.id, binding);
        this.bindingOrder = this.bindingOrder.filter((id) => id !== binding.id);
        this.bindingOrder.push(binding.id);
    }

    public unregisterPane(id: string) {
        if (this.dragSourcePaneId === id) {
            this.cancelDrag();
        }

        if (this.hoverPaneId === id) {
            const binding = this.bindings.get(id);
            if (binding) {
                binding.onHover?.({
                    item: null,
                    paneId: null,
                    localPos: binding.screenToLocal(ex.Vector.Zero),
                    screenPos: ex.Vector.Zero
                });
            }
            this.hoverPaneId = null;
        }

        this.bindings.delete(id);
        this.bindingOrder = this.bindingOrder.filter((bindingId) => bindingId !== id);
    }

    private handlePointerDown(event: ex.PointerEvent) {
        const hit = this.findItemAtScreenPos(event.screenPos);
        if (!hit) {
            this.emitHover(event.screenPos);
            return;
        }

        const isRightClick = (event.button as any) === ex.PointerButton.Right || (event.button as any) === 'Right';
        if (isRightClick) {
            hit.binding.onRightClick?.({
                item: hit.item,
                paneId: hit.binding.id,
                localPos: hit.localPos,
                screenPos: event.screenPos,
                event
            });
            return;
        }

        this.clearHover();
        this.startDrag(hit.item, hit.binding, event.screenPos);
    }

    private handlePointerMove(event: ex.PointerEvent) {
        if (this.draggedActor) {
            this.draggedActor.pos = event.screenPos.sub(this.dragOffset);
            return;
        }

        this.emitHover(event.screenPos);
    }

    private handlePointerUp(event: ex.PointerEvent) {
        if (!this.draggedItem || !this.dragSourcePaneId) {
            this.emitHover(event.screenPos);
            return;
        }

        const sourceBinding = this.bindings.get(this.dragSourcePaneId);
        const sourceContainer = sourceBinding?.getContainer() ?? null;
        let targetBinding: GridPaneRegistration | null = null;
        let handled = false;

        if (sourceBinding && sourceContainer) {
            targetBinding = this.findPaneAtScreenPos(event.screenPos);
            if (targetBinding) {
                const targetContainer = targetBinding.getContainer();
                if (targetContainer) {
                    const localPos = targetBinding.screenToLocal(event.screenPos);
                    const gridX = targetBinding.pane.getGridX(localPos);
                    const gridY = targetBinding.pane.getGridY(localPos);

                    if (targetBinding.id === sourceBinding.id) {
                        handled = GridContainerSystem.placeItem(sourceContainer, this.draggedItem.uid, gridX, gridY);
                    } else {
                        handled = GridContainerSystem.transferItemToPosition(
                            sourceContainer,
                            targetContainer,
                            this.draggedItem.uid,
                            gridX,
                            gridY
                        );
                    }
                }
            }

            if (!handled) {
                GridContainerSystem.placeItemOnGrid(sourceContainer, this.draggedItem);
            }
        }

        this.finishDrag(sourceBinding, targetBinding);
        this.emitHover(event.screenPos);
    }

    private startDrag(item: ItemBase, binding: GridPaneRegistration, screenPos: ex.Vector) {
        const sourceContainer = binding.getContainer();
        if (!sourceContainer) {
            return;
        }

        this.draggedItem = item;
        this.dragSourcePaneId = binding.id;

        const itemAnchor = binding.pane.getItemAnchor(item);
        const itemScreenAnchor = binding.localToScreen(itemAnchor);
        this.draggedActor = new ex.Actor({
            pos: itemScreenAnchor,
            width: binding.pane.getItemPixelWidth(item),
            height: binding.pane.getItemPixelHeight(item),
            z: 10001
        });

        this.draggedActor.graphics.use(new ex.Rectangle({
            width: binding.pane.getItemPixelWidth(item),
            height: binding.pane.getItemPixelHeight(item),
            color: binding.pane.getItemColor(item),
            strokeColor: ex.Color.White,
            lineWidth: 2
        }));

        this.dragOffset = screenPos.sub(this.draggedActor.pos);
        this.overlay.addChild(this.draggedActor);

        // 拖起时先释放源格占用，后续目标检测才能正确判断落点是否空闲。
        GridContainerSystem.removeItemFromGrid(sourceContainer, item);
    }

    private finishDrag(sourceBinding: GridPaneRegistration | undefined, targetBinding: GridPaneRegistration | null) {
        if (this.draggedActor) {
            this.overlay.removeChild(this.draggedActor);
        }

        const sourceChanged = sourceBinding?.onChanged;
        const targetChanged = targetBinding?.onChanged;

        this.draggedActor = null;
        this.draggedItem = null;
        this.dragSourcePaneId = null;
        this.dragOffset = ex.Vector.Zero;

        sourceChanged?.();
        if (targetBinding && targetBinding.id !== sourceBinding?.id) {
            targetChanged?.();
        }
    }

    private cancelDrag(notifyChanged: boolean = true) {
        if (!this.draggedItem || !this.dragSourcePaneId) {
            return;
        }

        const sourceBinding = this.bindings.get(this.dragSourcePaneId);
        const sourceContainer = sourceBinding?.getContainer() ?? null;
        if (sourceBinding && sourceContainer) {
            GridContainerSystem.placeItemOnGrid(sourceContainer, this.draggedItem);
        }

        if (this.draggedActor) {
            this.overlay.removeChild(this.draggedActor);
        }

        const changed = notifyChanged ? sourceBinding?.onChanged : undefined;

        this.draggedActor = null;
        this.draggedItem = null;
        this.dragSourcePaneId = null;
        this.dragOffset = ex.Vector.Zero;

        changed?.();
    }

    private emitHover(screenPos: ex.Vector) {
        const binding = this.findPaneAtScreenPos(screenPos);
        const nextHoverPaneId = binding?.id ?? null;

        if (this.hoverPaneId && this.hoverPaneId !== nextHoverPaneId) {
            const previousBinding = this.bindings.get(this.hoverPaneId);
            if (previousBinding) {
                previousBinding.onHover?.({
                    item: null,
                    paneId: null,
                    localPos: previousBinding.screenToLocal(screenPos),
                    screenPos
                });
            }
        }

        if (!binding) {
            this.hoverPaneId = null;
            return;
        }

        const localPos = binding.screenToLocal(screenPos);
        const item = binding.pane.findItemAt(localPos);
        binding.onHover?.({
            item,
            paneId: item ? binding.id : null,
            localPos,
            screenPos
        });
        this.hoverPaneId = binding.id;
    }

    private clearHover() {
        if (!this.hoverPaneId) {
            return;
        }

        const binding = this.bindings.get(this.hoverPaneId);
        if (binding) {
            binding.onHover?.({
                item: null,
                paneId: null,
                localPos: binding.screenToLocal(ex.Vector.Zero),
                screenPos: ex.Vector.Zero
            });
        }

        this.hoverPaneId = null;
    }

    private findItemAtScreenPos(screenPos: ex.Vector): HitResult | null {
        for (const binding of this.getBindingsInTopOrder()) {
            const localPos = binding.screenToLocal(screenPos);
            const item = binding.pane.findItemAt(localPos);
            if (item) {
                return { binding, item, localPos };
            }
        }

        return null;
    }

    private findPaneAtScreenPos(screenPos: ex.Vector): GridPaneRegistration | null {
        for (const binding of this.getBindingsInTopOrder()) {
            const localPos = binding.screenToLocal(screenPos);
            if (binding.pane.isPointInside(localPos)) {
                return binding;
            }
        }

        return null;
    }

    private getBindingsInTopOrder(): GridPaneRegistration[] {
        const result: GridPaneRegistration[] = [];
        for (let index = this.bindingOrder.length - 1; index >= 0; index--) {
            const binding = this.bindings.get(this.bindingOrder[index]);
            if (!binding) {
                continue;
            }

            if (binding.isActive && !binding.isActive()) {
                continue;
            }

            result.push(binding);
        }

        return result;
    }
}

let sharedManager: { scene: ex.Scene | null; manager: InventoryDragManager } | null = null;

export function getSharedInventoryDragManager(engine: ex.Engine): InventoryDragManager {
    const scene = engine.currentScene ?? null;
    if (!sharedManager || sharedManager.scene !== scene) {
        sharedManager?.manager.dispose();
        sharedManager = {
            scene,
            manager: new InventoryDragManager(engine)
        };
    }

    return sharedManager.manager;
}