import * as ex from 'excalibur';
import { GridContainerComponent } from './grid-container-component';

/**
 * 库存组件 —— 存储实体的背包/库存数据
 * 
 * 采用网格化库存系统（类似《暨黑破坏神》风格），
 * 物品可以占据多个网格，支持拖拽、旋转、堆叠等操作。
 * 纯数据组件，具体逻辑由 InventorySystem 处理。
 */
export class InventoryComponent extends GridContainerComponent {
    /** 组件类型标识 */
    public readonly type = 'inventory';

    /**
     * 向后兼容：旧代码使用 inventory.GRID_WIDTH / GRID_HEIGHT。
     * 新结构下实际值来自通用容器基类的 gridWidth / gridHeight。
     */
    public get GRID_WIDTH(): number {
        return this.gridWidth;
    }

    public get GRID_HEIGHT(): number {
        return this.gridHeight;
    }

    /** 待处理的道具使用请求队列，由UI或其他系统添加，InventorySystem 处理 */
    public pendingUseRequests: Array<{
        /** 要使用的物品ID */
        itemId: string;
        /** 目标实体（可选） */
        target?: ex.Entity;
        /** 请求时间戳 */
        timestamp: number;
    }> = [];

    constructor(options?: {
        gridWidth?: number;
        gridHeight?: number;
    }) {
        super({
            kind: 'inventory',
            gridWidth: options?.gridWidth ?? 8,
            gridHeight: options?.gridHeight ?? 5,
            allowRotate: true
        });
    }
}