import * as ex from 'excalibur';
import { ItemBase, ItemType } from '../item-base';

/** 网格容器类型：用于区分背包、箱子、快捷栏、技能栏等不同用途。 */
export type GridContainerKind = 'inventory' | 'chest' | 'hotbar' | 'skillbar' | 'generic';

/**
 * 通用网格容器组件（暗黑风格）：
 * - 一个容器由若干网格组成（宽 * 高）
 * - 每个物品可占据多个格子（由 item.width / item.height 决定）
 * - 容器之间可通过统一系统执行移动、堆叠、交换
 *
 * 该组件仅承载纯数据，不放置业务逻辑。
 */
export class GridContainerComponent extends ex.Component {
    public readonly type: string = 'grid-container';

    /** 容器用途标签，不影响核心算法，仅用于规则层判断。 */
    public readonly kind: GridContainerKind;

    /** 网格宽度（列数） */
    public readonly gridWidth: number;

    /** 网格高度（行数） */
    public readonly gridHeight: number;

    /** 是否允许在该容器中旋转物品。 */
    public readonly allowRotate: boolean;

    /** 容器允许的物品类型；为空表示不限制。 */
    public readonly acceptedTypes: Set<ItemType>;

    /** 物品映射表，键为实例 uid，值为物品数据。 */
    public items: Map<string, ItemBase> = new Map<string, ItemBase>();

    /** 网格占用情况，true 表示该格子已被占据。 */
    public grid: boolean[][] = [];

    constructor(options?: {
        kind?: GridContainerKind;
        gridWidth?: number;
        gridHeight?: number;
        allowRotate?: boolean;
        acceptedTypes?: ItemType[];
    }) {
        super();

        this.kind = options?.kind ?? 'generic';
        this.gridWidth = options?.gridWidth ?? 8;
        this.gridHeight = options?.gridHeight ?? 5;
        this.allowRotate = options?.allowRotate ?? true;
        this.acceptedTypes = new Set(options?.acceptedTypes ?? []);
        this.grid = GridContainerComponent.createEmptyGrid(this.gridWidth, this.gridHeight);
    }

    /** 重置占用网格到全空状态。 */
    public resetGrid() {
        this.grid = GridContainerComponent.createEmptyGrid(this.gridWidth, this.gridHeight);
    }

    private static createEmptyGrid(width: number, height: number): boolean[][] {
        const result: boolean[][] = [];
        for (let y = 0; y < height; y++) {
            result[y] = [];
            for (let x = 0; x < width; x++) {
                result[y][x] = false;
            }
        }
        return result;
    }
}