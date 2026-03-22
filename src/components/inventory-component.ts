import * as ex from 'excalibur';
import { ItemBase } from '../item-base';

export class InventoryComponent extends ex.Component {
    public readonly type = 'inventory';
    public items: Map<string, ItemBase> = new Map<string, ItemBase>();

    // 库存网格尺寸
    public readonly GRID_WIDTH = 8;
    public readonly GRID_HEIGHT = 5;

    // 网格占用情况（true表示被占用）
    public grid: boolean[][] = [];

    // 待处理的道具使用请求队列（纯数据）
    public pendingUseRequests: Array<{
        itemId: string;
        target?: ex.Entity;
        timestamp: number;
    }> = [];

    constructor() {
        super();
        // 初始化网格数据（纯数据操作）
        this.grid = [];
        for (let y = 0; y < this.GRID_HEIGHT; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.GRID_WIDTH; x++) {
                this.grid[y][x] = false;
            }
        }
    }
}