import * as ex from "excalibur";
import { ItemBase, ItemType, EquipmentSlotType } from "../item-base";

export type GridContainerKind = "inventory" | "chest" | "hotbar" | "skillbar" | "equipment" | "generic";

/**
 * 通用格子容器组件 —— 所有库存系统的基类
 */
export class GridContainerComponent extends ex.Component {
    public readonly type: string = "grid-container";
    public readonly kind: GridContainerKind;
    public readonly gridWidth: number;
    public readonly gridHeight: number;
    public readonly acceptedTypes: Set<ItemType>;
    public readonly slotType?: EquipmentSlotType;
    public items: Map<string, ItemBase> = new Map<string, ItemBase>();
    public version: number = 0;
    public readonly grid: boolean[][];
    public allowRotate: boolean = false;

    constructor(options?: {
        kind?: GridContainerKind;
        gridWidth?: number;
        gridHeight?: number;
        acceptedTypes?: ItemType[];
        slotType?: EquipmentSlotType;
        allowRotate?: boolean;
    }) {
        super();
        this.kind = options?.kind ?? "generic";
        this.gridWidth = options?.gridWidth ?? 8;
        this.gridHeight = options?.gridHeight ?? 5;
        this.acceptedTypes = new Set(options?.acceptedTypes ?? []);
        this.slotType = options?.slotType;
        this.allowRotate = options?.allowRotate ?? false;
        this.grid = [];
        for (let y = 0; y < this.gridHeight; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                this.grid[y][x] = false;
            }
        }
    }

    /** 检查指定格子是否被占用 */
    public isSlotOccupied(x: number, y: number): boolean {
        if (x < 0 || y < 0 || x >= this.gridWidth || y >= this.gridHeight) {
            return true;
        }
        return this.grid[y][x];
    }

    /** 获取指定格子上的物品（简化版：只检查左上角） */
    public getItemAt(x: number, y: number): ItemBase | undefined {
        for (const item of this.items.values()) {
            if (item.inventoryX === x && item.inventoryY === y) {
                return item;
            }
        }
        return undefined;
    }

    /** 获取当前已用格子数 */
    public get usedSlots(): number {
        return this.items.size;
    }

    /** 获取总格子数 */
    public get totalSlots(): number {
        return this.gridWidth * this.gridHeight;
    }

    /** 获取空格子数 */
    public get freeSlots(): number {
        return this.totalSlots - this.usedSlots;
    }
}
