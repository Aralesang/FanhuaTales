import * as ex from 'excalibur';
import { GridContainerComponent } from '../components/grid-container-component';
import { ItemBase, ItemType } from '../item-base';
import { GridContainerSystem } from '../systems/grid-container-system';

/**
 * 库存面板样式配置
 * 定义了面板中各元素的颜色主题，包括格子背景、边框、物品边框、标题、数量等
 */
type InventoryPaneStyle = {
    /** 格子背景色 */
    slotColor: ex.Color;
    /** 格子边框色 */
    slotStrokeColor: ex.Color;
    /** 物品边框色 */
    itemStrokeColor: ex.Color;
    /** 标题文字色 */
    titleColor: ex.Color;
    /** 堆叠数量文字色 */
    quantityColor: ex.Color;
    /** 物品名称文字色 */
    labelColor: ex.Color;
};

/**
 * 库存面板构造选项
 * 包含面板的位置、尺寸、网格行列数以及样式等配置
 */
type InventoryPaneOptions = {
    /** 面板标题文本（如"背包"、"快捷栏"） */
    title: string;
    /** 面板内容区域左上角的 X 坐标（相对于父 Actor） */
    startX: number;
    /** 面板内容区域左上角的 Y 坐标（相对于父 Actor） */
    startY: number;
    /** 标题标签的 Y 坐标 */
    headerY: number;
    /** 单个格子的边长（像素） */
    slotSize: number;
    /** 格子之间的间距（像素） */
    slotMargin: number;
    /** 网格列数 */
    gridWidth: number;
    /** 网格行数 */
    gridHeight: number;
    /** Z 轴基准值，面板内元素会在此基础上叠加层级 */
    zBase: number;
    /** 面板样式配置 */
    style: InventoryPaneStyle;
};

/**
 * 默认样式配置
 * 提供一套基础的暗黑风格配色，作为各面板的默认外观
 */
const DEFAULT_STYLE: InventoryPaneStyle = {
    slotColor: ex.Color.fromHex('#666666'),
    slotStrokeColor: ex.Color.White,
    itemStrokeColor: ex.Color.White,
    titleColor: ex.Color.White,
    quantityColor: ex.Color.Yellow,
    labelColor: ex.Color.White
};

/**
 * 通用库存面板类
 *
 * 职责：只负责单个库存区域的绘制与命中检测，不包含任何交互逻辑。
 * 具体的拖拽、跨面板转移、右键使用等交互由上层 UI（如 InventoryUI、HotbarUI）
 * 通过 InventoryDragManager 组合控制。
 *
 * 性能优化：采用渲染键（renderKey）机制，只有当容器数据发生变化时才重新创建
 * UI Actor，避免每帧重复销毁/重建带来的性能开销。
 */
export class InventoryPane {
    /** 根 Actor，所有面板内的 UI 元素都挂载于此 */
    private readonly root: ex.Actor;
    /** 当前已创建的 UI 元素缓存列表，用于 clear() 时批量清理 */
    private readonly itemSlots: ex.Actor[] = [];
    /** 当前绑定的网格容器（背包/快捷栏/箱子等），为 null 时只渲染空格子 */
    private container: GridContainerComponent | null = null;
    /** 面板标题 */
    private title: string;
    /** 上次渲染的哈希键，用于判断是否需要重绘 */
    private lastRenderKey: string | null = null;

    // ===== 布局参数（构造时传入，后续只读） =====
    private readonly startX: number;
    private readonly startY: number;
    private readonly headerY: number;
    private readonly slotSize: number;
    private readonly slotMargin: number;
    private readonly gridWidth: number;
    private readonly gridHeight: number;
    private readonly zBase: number;
    private readonly style: InventoryPaneStyle;

    /**
     * 构造一个库存面板
     * @param options - 面板的配置选项，包含位置、尺寸、样式等
     */
    constructor(options: InventoryPaneOptions) {
        this.title = options.title;
        this.startX = options.startX;
        this.startY = options.startY;
        this.headerY = options.headerY;
        this.slotSize = options.slotSize;
        this.slotMargin = options.slotMargin;
        this.gridWidth = options.gridWidth;
        this.gridHeight = options.gridHeight;
        this.zBase = options.zBase;
        this.style = options.style;

        // 创建根 Actor，作为所有子元素的挂载点
        this.root = new ex.Actor({
            pos: ex.vec(0, 0),
            z: 1000
        });
    }

    /**
     * 将本面板挂载到指定的父 Actor 下
     * @param parent - 父 Actor，通常是 ScreenElement 或其他容器
     */
    public attachTo(parent: ex.Actor) {
        parent.addChild(this.root);
    }

    /**
     * 设置当前绑定的容器（兼容旧命名）
     * 当容器引用发生变化时，会清空渲染键以触发下一次重绘
     * @param container - 要绑定的网格容器，可为 null
     */
    public setInventory(container: GridContainerComponent | null) {
        if (this.container !== container) {
            this.lastRenderKey = null;
        }
        this.container = container;
    }

    /**
     * 设置当前绑定的容器（推荐命名）
     * 与 setInventory 功能完全一致，只是命名更符合当前架构
     * @param container - 要绑定的网格容器，可为 null
     */
    public setContainer(container: GridContainerComponent | null) {
        if (this.container !== container) {
            this.lastRenderKey = null;
        }
        this.container = container;
    }

    /**
     * 设置面板标题
     * 标题变化会触发下一次重绘
     * @param title - 新的标题文本
     */
    public setTitle(title: string) {
        if (this.title !== title) {
            this.lastRenderKey = null;
        }
        this.title = title;
    }

    /**
     * 执行面板渲染
     * 通过对比渲染键决定是否真正重绘；如果内容与上次相同则直接跳过，
     * 避免不必要的 Actor 创建/销毁操作
     */
    public render() {
        const renderKey = this.createRenderKey();
        if (renderKey === this.lastRenderKey) {
            return;
        }

        this.clear();
        this.renderTitle();
        this.renderGrid();
        this.renderItems();
        this.lastRenderKey = renderKey;
    }

    /**
     * 清空面板内的所有 UI 元素
     * 将所有已创建的 Actor 从根节点移除，并清空缓存数组
     */
    public clear() {
        this.itemSlots.forEach(slot => this.root.removeChild(slot));
        this.itemSlots.length = 0;
        this.lastRenderKey = null;
    }

    /**
     * 检测指定本地坐标下是否有物品
     * 用于拖拽管理器的命中检测，判断鼠标/指针是否点中了某个物品
     *
     * @param localPos - 相对于面板根 Actor 的本地坐标
     * @returns 命中位置的物品对象，未命中则返回 null
     */
    public findItemAt(localPos: ex.Vector): ItemBase | null {
        if (!this.container) {
            return null;
        }

        // 先计算点击的是哪个格子
        const gridX = this.getGridX(localPos);
        const gridY = this.getGridY(localPos);

        // 检查是否越界
        if (gridX < 0 || gridY < 0 || gridX >= this.gridWidth || gridY >= this.gridHeight) {
            return null;
        }

        // 查找该格子上的物品
        return this.container.getItemAt(gridX, gridY) ?? null;
    }

    /**
     * 判断指定本地坐标是否位于面板网格区域内
     * 用于拖拽管理器判断指针是否进入了本面板范围
     *
     * @param localPos - 相对于面板根 Actor 的本地坐标
     * @returns 在区域内返回 true，否则返回 false
     */
    public isPointInside(localPos: ex.Vector): boolean {
        return localPos.x >= this.startX
            && localPos.x <= this.startX + this.getPixelWidth()
            && localPos.y >= this.startY
            && localPos.y <= this.startY + this.getPixelHeight();
    }

    /**
     * 将本地 X 坐标转换为网格列索引
     * 用于拖拽释放时计算物品应放置的目标格子列号
     *
     * @param localPos - 相对于面板根 Actor 的本地坐标
     * @returns 网格列索引（从 0 开始）
     */
    public getGridX(localPos: ex.Vector): number {
        return Math.floor((localPos.x - this.startX) / (this.slotSize + this.slotMargin));
    }

    /**
     * 将本地 Y 坐标转换为网格行索引
     * 用于拖拽释放时计算物品应放置的目标格子行号
     *
     * @param localPos - 相对于面板根 Actor 的本地坐标
     * @returns 网格行索引（从 0 开始）
     */
    public getGridY(localPos: ex.Vector): number {
        return Math.floor((localPos.y - this.startY) / (this.slotSize + this.slotMargin));
    }

    /**
     * 获取指定物品在面板中的中心点坐标（像素）
     * 用于拖拽开始时创建跟随鼠标的拖拽图标，使其初始位置与原物品重合
     *
     * @param item - 目标物品
     * @returns 物品中心点的本地坐标
     */
    public getItemAnchor(item: ItemBase): ex.Vector {
        return ex.vec(
            this.startX + (item.inventoryX || 0) * (this.slotSize + this.slotMargin) + this.slotSize / 2,
            this.startY + (item.inventoryY || 0) * (this.slotSize + this.slotMargin) + this.slotSize / 2
        );
    }

    /**
     * 获取物品在面板中的像素大小
     * 每个物品只占一格
     */
    public getItemPixelSize(): number {
        return this.slotSize;
    }

    /**
     * 根据物品类型返回对应的颜色标识
     * 不同类型物品使用不同颜色便于玩家直观区分：
     * - Consumable（消耗品）：绿色
     * - Equipment（装备）：蓝色
     * - Material（材料）：金黄色
     * - Key（钥匙/任务道具）：暗红色
     * - 其他：灰色
     *
     * @param item - 目标物品
     * @returns Excalibur 颜色对象
     */
    public getItemColor(item: ItemBase): ex.Color {
        switch (item.type) {
            case ItemType.Consumable:
                return ex.Color.fromHex('#3ba55c');
            case ItemType.Equipment:
                return ex.Color.fromHex('#3c78d8');
            case ItemType.Material:
                return ex.Color.fromHex('#c9a227');
            case ItemType.Key:
                return ex.Color.fromHex('#b33a3a');
            default:
                return ex.Color.Gray;
        }
    }

    /**
     * 创建完整的样式配置
     * 将传入的部分样式与默认样式合并，未指定的字段使用默认值
     *
     * @param style - 部分样式配置
     * @returns 完整的样式配置对象
     */
    public static createStyle(style: Partial<InventoryPaneStyle>): InventoryPaneStyle {
        return { ...DEFAULT_STYLE, ...style };
    }

    // ===== 私有渲染方法 =====

    /**
     * 渲染面板标题
     * 在 headerY 位置居中显示标题文本
     */
    private renderTitle() {
        const titleLabel = new ex.Label({
            text: this.title,
            font: new ex.Font({
                family: 'Arial',
                size: 22,
                color: this.style.titleColor,
                textAlign: ex.TextAlign.Center
            }),
            pos: ex.vec(this.startX + this.getPixelWidth() / 2, this.headerY),
            z: this.zBase + 1
        });

        this.root.addChild(titleLabel);
        this.itemSlots.push(titleLabel);
    }

    /**
     * 渲染网格背景
     * 根据 gridWidth × gridHeight 创建对应数量的格子矩形
     * 每个格子都是一个带边框的矩形 Actor
     */
    private renderGrid() {
        for (let row = 0; row < this.gridHeight; row++) {
            for (let col = 0; col < this.gridWidth; col++) {
                // 计算当前格子的左上角像素坐标
                const slotX = this.startX + col * (this.slotSize + this.slotMargin);
                const slotY = this.startY + row * (this.slotSize + this.slotMargin);

                // 创建格子背景 Actor，位置为中心点（Excalibur Actor 的原点在中心）
                const slotBg = new ex.Actor({
                    pos: ex.vec(slotX + this.slotSize / 2, slotY + this.slotSize / 2),
                    width: this.slotSize,
                    height: this.slotSize,
                    z: this.zBase + 1
                });

                // 使用矩形图形作为格子背景
                slotBg.graphics.use(new ex.Rectangle({
                    width: this.slotSize,
                    height: this.slotSize,
                    color: this.style.slotColor,
                    strokeColor: this.style.slotStrokeColor,
                    lineWidth: 1
                }));

                this.root.addChild(slotBg);
                this.itemSlots.push(slotBg);
            }
        }
    }

    /**
     * 渲染容器中的物品
     * 为每个物品创建：彩色矩形图标 + 名称标签 + 堆叠数量标签（可堆叠且大于1时）
     */
    private renderItems() {
        if (!this.container) {
            return;
        }

        for (const item of GridContainerSystem.getAllItems(this.container)) {
            // 跳过未放置在网格中的物品（理论上不应发生，作为防御）
            if (item.inventoryX === undefined || item.inventoryY === undefined) {
                continue;
            }

            // 计算物品左上角的像素坐标
            const itemX = this.startX + item.inventoryX * (this.slotSize + this.slotMargin);
            const itemY = this.startY + item.inventoryY * (this.slotSize + this.slotMargin);

            // ===== 1. 物品图标矩形 =====
            const itemIcon = new ex.Actor({
                pos: ex.vec(itemX + this.slotSize / 2, itemY + this.slotSize / 2),
                width: this.slotSize,
                height: this.slotSize,
                z: this.zBase + 2  // 图标层级高于格子背景
            });

            itemIcon.graphics.use(new ex.Rectangle({
                width: this.slotSize,
                height: this.slotSize,
                color: this.getItemColor(item),
                strokeColor: this.style.itemStrokeColor,
                lineWidth: 1
            }));

            this.root.addChild(itemIcon);
            this.itemSlots.push(itemIcon);

            // ===== 2. 物品名称标签 =====
            const nameLabel = new ex.Label({
                text: item.name,
                font: new ex.Font({
                    family: 'Arial',
                    size: 10,
                    color: this.style.labelColor,
                    textAlign: ex.TextAlign.Center
                }),
                pos: ex.vec(itemX + this.slotSize / 2, itemY + this.slotSize / 2 - 6),
                z: this.zBase + 3  // 文字层级高于图标
            });
            this.root.addChild(nameLabel);
            this.itemSlots.push(nameLabel);

            // ===== 3. 堆叠数量标签（仅当可堆叠且数量大于1时显示） =====
            if (item.stackable && item.quantity > 1) {
                const quantityLabel = new ex.Label({
                    text: item.quantity.toString(),
                    font: new ex.Font({
                        family: 'Arial',
                        size: 12,
                        color: this.style.quantityColor,
                        textAlign: ex.TextAlign.Right
                    }),
                    pos: ex.vec(itemX + this.slotSize - 10, itemY + this.slotSize - 10),
                    z: this.zBase + 3
                });
                this.root.addChild(quantityLabel);
                this.itemSlots.push(quantityLabel);
            }
        }
    }

    /**
     * 计算面板的总像素宽度
     * 公式：列数 × (格子大小 + 间距) - 最后一个不需要的间距
     */
    private getPixelWidth(): number {
        return this.gridWidth * (this.slotSize + this.slotMargin) - this.slotMargin;
    }

    /**
     * 计算面板的总像素高度
     * 公式：行数 × (格子大小 + 间距) - 最后一个不需要的间距
     */
    private getPixelHeight(): number {
        return this.gridHeight * (this.slotSize + this.slotMargin) - this.slotMargin;
    }

    /**
     * 生成当前面板的渲染快照键（哈希字符串）
     *
     * 用于判断面板内容是否发生变化，从而决定是否需要重绘。
     * 以下变化会触发重绘：
     * - 标题文本变化
     * - 容器引用切换（不同背包/快捷栏之间切换）
     * - 容器的行列尺寸变化
     * - 物品的摆放位置、数量、名称变化
     *
     * 这样即使上层每帧调用 render()，只要内容未变化，就不会反复销毁/重建 UI Actor，
     * 显著提升渲染性能。
     *
     * @returns 唯一标识当前面板状态的字符串
     */
    private createRenderKey(): string {
        if (!this.container) {
            return `${this.title}|empty`;
        }

        // 将所有物品的关键属性拼接为字符串数组，排序后合并
        // 排序是为了保证相同物品集合在不同遍历顺序下生成相同的键
        const items = GridContainerSystem.getAllItems(this.container)
            .map((item) => [
                item.uid,           // 唯一标识
                item.inventoryX ?? -1,  // 网格X坐标
                item.inventoryY ?? -1,  // 网格Y坐标
                item.quantity,      // 堆叠数量
                item.name           // 物品名称
            ].join(':'))
            .sort();

        return [
            this.title,
            this.container.kind,
            this.container.gridWidth,
            this.container.gridHeight,
            this.container.version,
            items.join('|')
        ].join('#');
    }
}
