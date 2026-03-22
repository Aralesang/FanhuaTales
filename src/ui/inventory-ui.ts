import * as ex from 'excalibur';
import { InventoryComponent } from '../components/inventory-component';
import { ItemBase, ItemType } from '../item-base';
import { InventorySystem } from '../systems/inventory-system';

export class InventoryUI extends ex.ScreenElement {
    private inventory: InventoryComponent | null = null;
    private owner: ex.Entity | null = null;
    private background: ex.Rectangle;
    private itemSlots: ex.Actor[] = [];
    private isVisible: boolean = false;

    // 拖拽相关
    private draggedItem: ItemBase | null = null;
    private draggedActor: ex.Actor | null = null;
    private dragOffset: ex.Vector = ex.Vector.Zero;
    private isDragging: boolean = false;

    // 悬停详情
    private hoverPanel: ex.Actor | null = null;
    private hoverLabel: ex.Label | null = null;

    // 网格常量
    private readonly SLOT_SIZE = 48;
    private readonly SLOT_MARGIN = 4;
    private readonly GRID_WIDTH = 8;
    private readonly GRID_HEIGHT = 5;
    private readonly GRID_START_X = -180;
    private readonly GRID_START_Y = -120;

    constructor() {
        // 计算背景尺寸 - 使用硬编码值以避免在super()之前使用this
        const gridWidth = 8 * (48 + 4) - 4;  // GRID_WIDTH * (SLOT_SIZE + SLOT_MARGIN) - SLOT_MARGIN
        const gridHeight = 5 * (48 + 4) - 4; // GRID_HEIGHT * (SLOT_SIZE + SLOT_MARGIN) - SLOT_MARGIN
        const titleHeight = 40;
        const padding = 20;

        super({
            x: 400,
            y: 300,
            width: gridWidth + padding * 2,
            height: gridHeight + titleHeight + padding * 2,
            anchor: ex.Vector.Half,
            z: 1000
        });

        this.background = new ex.Rectangle({
            width: gridWidth + padding * 2,
            height: gridHeight + titleHeight + padding * 2,
            color: ex.Color.fromHex('#333333'),
            strokeColor: ex.Color.White,
            lineWidth: 2
        });

        // 添加鼠标事件监听
        this.on('pointerdown', (evt) => this.onPointerDown(evt));
        this.on('pointermove', (evt) => this.onPointerMove(evt));
        this.on('pointerup', (evt) => this.onPointerUp(evt));

        // 初始化悬停细节
        this.hoverPanel = new ex.Actor({
            pos: ex.vec(0, 0),
            width: 220,
            height: 70,
            z: 1100
        });
        this.hoverPanel.graphics.use(new ex.Rectangle({
            width: 220,
            height: 70,
            color: ex.Color.fromHex('#111111cc'),
            strokeColor: ex.Color.White,
            lineWidth: 1
        }));
        this.hoverPanel.graphics.opacity = 0;

        this.hoverLabel = new ex.Label({
            text: '',
            font: new ex.Font({ family: 'Arial', size: 14, color: ex.Color.White }),
            pos: ex.vec(-100, -25),
            z: 1101
        });
        this.hoverPanel.addChild(this.hoverLabel);
        this.addChild(this.hoverPanel);

        // 默认不显示，不设置graphics
    }

    setInventory(inventory: InventoryComponent) {
        if (this.inventory === inventory) {
            return;
        }
        this.inventory = inventory;
        if (this.isVisible) {
            this.updateDisplay();
        }
    }

    setOwner(owner: ex.Entity) {
        this.owner = owner;
    }

    public isOpen(): boolean {
        return this.isVisible;
    }

    show() {
        this.isVisible = true;
        this.graphics.use(this.background);
        this.updateDisplay();
    }

    hide() {
        this.isVisible = false;
        this.graphics.hide();
        // 清除所有子元素
        this.itemSlots.forEach(slot => this.removeChild(slot));
        this.itemSlots = [];
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    private onPointerDown(evt: ex.PointerEvent) {
        if (!this.inventory || !this.isVisible) return;

        // 转换为本地坐标 (相对于UI的位置)
        const localPos = evt.screenPos.sub(ex.vec(400, 300)); // UI中心位置

        // 判断右键（使用道具）
        const isRightClick = (evt.button as any) === ex.PointerButton.Right || (evt.button as any) === 'Right';
        if (isRightClick) {
            const items = InventorySystem.getAllItems(this.inventory);
            for (const item of items) {
                if (item.inventoryX !== undefined && item.inventoryY !== undefined) {
                    const itemLeft = this.GRID_START_X + item.inventoryX * (this.SLOT_SIZE + this.SLOT_MARGIN);
                    const itemTop = this.GRID_START_Y + item.inventoryY * (this.SLOT_SIZE + this.SLOT_MARGIN);
                    const itemRight = itemLeft + item.width * (this.SLOT_SIZE + this.SLOT_MARGIN) - this.SLOT_MARGIN;
                    const itemBottom = itemTop + item.height * (this.SLOT_SIZE + this.SLOT_MARGIN) - this.SLOT_MARGIN;

                    if (localPos.x >= itemLeft && localPos.x <= itemRight &&
                        localPos.y >= itemTop && localPos.y <= itemBottom) {
                        if (this.owner) {
                            // 设置数据标记，系统会在update中检测并处理
                            InventorySystem.addUseRequest(this.inventory, item.id, this.owner);
                            console.log(`标记道具使用请求：${item.name}`);
                            // 注意：实际的物品消耗将在系统处理完成后进行
                        }
                        (evt as any).preventDefault?.();
                        return;
                    }
                }
            }
        }

        // 检查是否点击了物品（左键拖拽）
        const items = InventorySystem.getAllItems(this.inventory);
        for (const item of items) {
            if (item.inventoryX !== undefined && item.inventoryY !== undefined) {
                const itemLeft = this.GRID_START_X + item.inventoryX * (this.SLOT_SIZE + this.SLOT_MARGIN);
                const itemTop = this.GRID_START_Y + item.inventoryY * (this.SLOT_SIZE + this.SLOT_MARGIN);
                const itemRight = itemLeft + item.width * (this.SLOT_SIZE + this.SLOT_MARGIN) - this.SLOT_MARGIN;
                const itemBottom = itemTop + item.height * (this.SLOT_SIZE + this.SLOT_MARGIN) - this.SLOT_MARGIN;

                if (localPos.x >= itemLeft && localPos.x <= itemRight &&
                    localPos.y >= itemTop && localPos.y <= itemBottom) {
                    // 开始拖拽
                    this.startDrag(item, localPos);
                    break;
                }
            }
        }
    }

    private onPointerMove(evt: ex.PointerEvent) {
        const localPos = evt.screenPos.sub(ex.vec(400, 300));

        if (this.isDragging && this.draggedActor) {
            this.draggedActor.pos = localPos.sub(this.dragOffset);
        } else {
            // 悬停显示物品详情
            this.updateHover(localPos);
        }
    }

    private onPointerUp(evt: ex.PointerEvent) {
        if (this.isDragging && this.draggedItem && this.draggedActor) {
            const localPos = evt.screenPos.sub(ex.vec(400, 300));
            this.endDrag(localPos);
        }
    }

    private startDrag(item: ItemBase, mousePos: ex.Vector) {
        this.draggedItem = item;
        this.isDragging = true;

        // 计算物品在屏幕上的位置
        const itemScreenX = this.GRID_START_X + (item.inventoryX || 0) * (this.SLOT_SIZE + this.SLOT_MARGIN);
        const itemScreenY = this.GRID_START_Y + (item.inventoryY || 0) * (this.SLOT_SIZE + this.SLOT_MARGIN);

        // 创建拖拽中的物品显示
        this.draggedActor = new ex.Actor({
            pos: ex.vec(itemScreenX + item.width * this.SLOT_SIZE / 2, itemScreenY + item.height * this.SLOT_SIZE / 2),
            width: item.width * this.SLOT_SIZE,
            height: item.height * this.SLOT_SIZE,
            z: 1004
        });

        // 设置物品颜色
        let iconColor = ex.Color.Gray;
        switch (item.type) {
            case ItemType.Consumable:
                iconColor = ex.Color.Green;
                break;
            case ItemType.Equipment:
                iconColor = ex.Color.Blue;
                break;
            case ItemType.Material:
                iconColor = ex.Color.Yellow;
                break;
            case ItemType.Key:
                iconColor = ex.Color.Red;
                break;
        }

        this.draggedActor.graphics.use(new ex.Rectangle({
            width: item.width * this.SLOT_SIZE,
            height: item.height * this.SLOT_SIZE,
            color: iconColor,
            strokeColor: ex.Color.White,
            lineWidth: 2
        }));

        this.dragOffset = mousePos.sub(this.draggedActor.pos);
        this.addChild(this.draggedActor);

        // 从库存中临时移除物品
        if (this.inventory) {
            InventorySystem.removeItemFromGrid(this.inventory, item);
        }
    }

    private updateHover(localPos: ex.Vector) {
        if (!this.inventory || !this.isVisible) return;

        const items = InventorySystem.getAllItems(this.inventory);
        let hoveredItem: ItemBase | null = null;

        for (const item of items) {
            if (item.inventoryX !== undefined && item.inventoryY !== undefined) {
                const itemLeft = this.GRID_START_X + item.inventoryX * (this.SLOT_SIZE + this.SLOT_MARGIN);
                const itemTop = this.GRID_START_Y + item.inventoryY * (this.SLOT_SIZE + this.SLOT_MARGIN);
                const itemRight = itemLeft + item.width * (this.SLOT_SIZE + this.SLOT_MARGIN) - this.SLOT_MARGIN;
                const itemBottom = itemTop + item.height * (this.SLOT_SIZE + this.SLOT_MARGIN) - this.SLOT_MARGIN;

                if (localPos.x >= itemLeft && localPos.x <= itemRight && localPos.y >= itemTop && localPos.y <= itemBottom) {
                    hoveredItem = item;
                    break;
                }
            }
        }

        if (hoveredItem) {
            this.showHover(hoveredItem, localPos);
        } else {
            this.hideHover();
        }
    }

    private showHover(item: ItemBase, localPos: ex.Vector) {
        if (!this.hoverPanel || !this.hoverLabel) return;

        const detail = `${item.name}\n${item.description}\n数量: ${item.quantity}`;
        this.hoverLabel.text = detail;

        // 调整位置
        this.hoverPanel.pos = ex.vec(localPos.x + 110, localPos.y + 60);
        this.hoverPanel.graphics.opacity = 1;
    }

    private hideHover() {
        if (this.hoverPanel) {
            this.hoverPanel.graphics.opacity = 0;
        }
    }

    private endDrag(mousePos: ex.Vector) {
        if (!this.draggedItem || !this.draggedActor || !this.inventory) return;

        // 计算网格位置
        const gridX = Math.floor((mousePos.x - this.GRID_START_X) / (this.SLOT_SIZE + this.SLOT_MARGIN));
        const gridY = Math.floor((mousePos.y - this.GRID_START_Y) / (this.SLOT_SIZE + this.SLOT_MARGIN));

        // 尝试放置物品
        if (this.inventory && InventorySystem.isGridPositionFree(this.inventory, gridX, gridY, this.draggedItem.width, this.draggedItem.height)) {
            InventorySystem.placeItem(this.inventory, this.draggedItem.id, gridX, gridY);
        } else {
            // 如果无法放置，放回原位置
            if (this.draggedItem.inventoryX !== undefined && this.draggedItem.inventoryY !== undefined) {
                InventorySystem.placeItemOnGrid(this.inventory, this.draggedItem);
            }
        }

        // 清理拖拽状态
        this.removeChild(this.draggedActor);
        this.draggedActor = null;
        this.draggedItem = null;
        this.isDragging = false;

        // 重新渲染界面
        this.updateDisplay();
    }

    private updateDisplay() {
        if (!this.inventory || !this.isVisible) return;

        // 清除之前的元素
        this.itemSlots.forEach(slot => this.removeChild(slot));
        this.itemSlots = [];

        const items = InventorySystem.getAllItems(this.inventory);

        // 标题
        const titleLabel = new ex.Label({
            text: '库存',
            font: new ex.Font({
                family: 'Arial',
                size: 24,
                color: ex.Color.White
            }),
            pos: ex.vec(0, -160),
            z: 1001
        });
        this.addChild(titleLabel);
        this.itemSlots.push(titleLabel);

        // 创建网格格子
        for (let row = 0; row < this.GRID_HEIGHT; row++) {
            for (let col = 0; col < this.GRID_WIDTH; col++) {
                const slotX = this.GRID_START_X + col * (this.SLOT_SIZE + this.SLOT_MARGIN);
                const slotY = this.GRID_START_Y + row * (this.SLOT_SIZE + this.SLOT_MARGIN);

                // 创建格子背景
                const slotBg = new ex.Actor({
                    pos: ex.vec(slotX + this.SLOT_SIZE / 2, slotY + this.SLOT_SIZE / 2),
                    width: this.SLOT_SIZE,
                    height: this.SLOT_SIZE,
                    z: 1001
                });

                // 设置格子边框
                slotBg.graphics.use(new ex.Rectangle({
                    width: this.SLOT_SIZE,
                    height: this.SLOT_SIZE,
                    color: ex.Color.fromHex('#666666'),
                    strokeColor: ex.Color.White,
                    lineWidth: 1
                }));

                this.addChild(slotBg);
                this.itemSlots.push(slotBg);
            }
        }

        // 显示物品
        for (const item of items) {
            if (item.inventoryX !== undefined && item.inventoryY !== undefined) {
                const itemX = this.GRID_START_X + item.inventoryX * (this.SLOT_SIZE + this.SLOT_MARGIN);
                const itemY = this.GRID_START_Y + item.inventoryY * (this.SLOT_SIZE + this.SLOT_MARGIN);

                // 创建物品图标
                const itemIcon = new ex.Actor({
                    pos: ex.vec(itemX + item.width * this.SLOT_SIZE / 2, itemY + item.height * this.SLOT_SIZE / 2),
                    width: item.width * this.SLOT_SIZE,
                    height: item.height * this.SLOT_SIZE,
                    z: 1002
                });

                // 根据物品类型设置不同颜色
                let iconColor = ex.Color.Gray;
                switch (item.type) {
                    case ItemType.Consumable:
                        iconColor = ex.Color.Green;
                        break;
                    case ItemType.Equipment:
                        iconColor = ex.Color.Blue;
                        break;
                    case ItemType.Material:
                        iconColor = ex.Color.Yellow;
                        break;
                    case ItemType.Key:
                        iconColor = ex.Color.Red;
                        break;
                }

                itemIcon.graphics.use(new ex.Rectangle({
                    width: item.width * this.SLOT_SIZE,
                    height: item.height * this.SLOT_SIZE,
                    color: iconColor,
                    strokeColor: ex.Color.White,
                    lineWidth: 1
                }));

                this.addChild(itemIcon);
                this.itemSlots.push(itemIcon);

                // 显示物品名称
                const nameLabel = new ex.Label({
                    text: item.name,
                    font: new ex.Font({
                        family: 'Arial',
                        size: 10,
                        color: ex.Color.White
                    }),
                    pos: ex.vec(itemX + item.width * this.SLOT_SIZE / 2, itemY + item.height * this.SLOT_SIZE / 2),
                    z: 1003
                });
                this.addChild(nameLabel);
                this.itemSlots.push(nameLabel);

                // 显示数量（如果大于1且是可堆叠物品）
                if (item.stackable && item.quantity > 1) {
                    const quantityLabel = new ex.Label({
                        text: item.quantity.toString(),
                        font: new ex.Font({
                            family: 'Arial',
                            size: 12,
                            color: ex.Color.Yellow
                        }),
                        pos: ex.vec(itemX + item.width * this.SLOT_SIZE - 10, itemY + item.height * this.SLOT_SIZE - 10),
                        z: 1003
                    });
                    this.addChild(quantityLabel);
                    this.itemSlots.push(quantityLabel);
                }
            }
        }
    }
}