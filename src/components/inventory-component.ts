import * as ex from 'excalibur';
import { ItemBase } from '../item-base';

/**
 * 库存组件 —— 存储实体的背包/库存数据
 * 
 * 采用网格化库存系统（类似《暨黑破坏神》风格），
 * 物品可以占据多个网格，支持拖拽、旋转、堆叠等操作。
 * 纯数据组件，具体逻辑由 InventorySystem 处理。
 */
export class InventoryComponent extends ex.Component {
    /** 组件类型标识 */
    public readonly type = 'inventory';

    /** 物品映射表，键为物品ID，值为物品数据 */
    public items: Map<string, ItemBase> = new Map<string, ItemBase>();

    /** 网格宽度（列数） */
    public readonly GRID_WIDTH = 8;
    /** 网格高度（行数） */
    public readonly GRID_HEIGHT = 5;

    /** 网格占用情况，true 表示该格子已被物品占据 */
    public grid: boolean[][] = [];

    /** 待处理的道具使用请求队列，由UI或其他系统添加，InventorySystem 处理 */
    public pendingUseRequests: Array<{
        /** 要使用的物品ID */
        itemId: string;
        /** 目标实体（可选） */
        target?: ex.Entity;
        /** 请求时间戳 */
        timestamp: number;
    }> = [];

    constructor() {
        super();
        // 初始化网格，所有格子初始为未占用
        this.grid = [];
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                this.grid[y][x] = false;
            }
        }
    }
}