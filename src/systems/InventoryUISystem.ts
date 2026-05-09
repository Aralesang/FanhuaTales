import { Scene, GameObjects, Input } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { InventoryComponent, ItemDefinition, InventoryItem } from '../ecs/Component';

/**
 * 库存 UI 系统
 *
 * 职责：
 * - 按 B 键打开/关闭库存界面
 * - 渲染 5×4 网格，用纯色方块表示物品
 * - 左键：拿起全部 / 放入全部 / 堆叠 / 交换
 * - 右键：拆分拿起一半 / 放入1个 / 堆叠1个 / 交换
 */
export class InventoryUISystem extends System {
    private isOpen: boolean = false;
    private previousBDown: boolean = false;
    private bKey: Input.Keyboard.Key | null = null;

    // 手持物品状态
    private heldItem: InventoryItem | null = null;
    private heldFromSlot: number = -1;

    // 当前打开的库存所属实体
    private targetEntity: Entity | null = null;

    // UI 元素
    private panel!: GameObjects.Graphics;
    private itemGraphics!: GameObjects.Graphics;
    private heldGraphics!: GameObjects.Graphics;
    private quantityTexts: GameObjects.Text[] = [];
    private heldText!: GameObjects.Text;

    // 网格配置（5 列 × 4 行 = 20 格）
    private readonly COLS = 5;
    private readonly ROWS = 4;
    private readonly CELL_SIZE = 40;
    private readonly GAP = 4;
    private readonly PADDING = 12;

    private gridX: number = 0;
    private gridY: number = 0;
    private panelW: number = 0;
    private panelH: number = 0;

    // 物品颜色映射（纯色方块）
    private readonly itemColors: Record<string, number> = {
        health_potion: 0xcc3333,
        iron_sword: 0x888888,
        gold_coin: 0xffcc00,
        leather_armor: 0x8b5a2b,
        wooden_helmet: 0xa0522d,
    };

    constructor(scene: Scene) {
        super(scene);
        this.bKey = scene.input.keyboard?.addKey('B') ?? null;
        this.initUI();
        scene.input.on('pointerdown', this.onPointerDown, this);
    }

    private initUI(): void {
        const cam = this.scene.cameras.main;
        const screenW = cam.width;
        const screenH = cam.height;

        this.panelW = this.COLS * this.CELL_SIZE + (this.COLS - 1) * this.GAP + this.PADDING * 2;
        this.panelH = this.ROWS * this.CELL_SIZE + (this.ROWS - 1) * this.GAP + this.PADDING * 2;
        this.gridX = (screenW - this.panelW) / 2 + this.PADDING;
        this.gridY = (screenH - this.panelH) / 2 + this.PADDING;

        // 背景面板（不随相机滚动）
        this.panel = this.scene.add.graphics();
        this.panel.setDepth(1000);
        this.panel.setScrollFactor(0);
        this.panel.visible = false;

        // 物品方块层
        this.itemGraphics = this.scene.add.graphics();
        this.itemGraphics.setDepth(1001);
        this.itemGraphics.setScrollFactor(0);
        this.itemGraphics.visible = false;

        // 手持物品层
        this.heldGraphics = this.scene.add.graphics();
        this.heldGraphics.setDepth(1002);
        this.heldGraphics.setScrollFactor(0);
        this.heldGraphics.visible = false;

        // 数量文字池（最大 20 格）
        for (let i = 0; i < 20; i++) {
            const text = this.scene.add.text(0, 0, '', {
                fontSize: '12px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2,
            });
            text.setDepth(1001);
            text.setScrollFactor(0);
            text.setOrigin(1, 1);
            text.visible = false;
            this.quantityTexts.push(text);
        }

        // 手持物品数量文字
        this.heldText = this.scene.add.text(0, 0, '', {
            fontSize: '12px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2,
        });
        this.heldText.setDepth(1002);
        this.heldText.setScrollFactor(0);
        this.heldText.setOrigin(1, 1);
        this.heldText.visible = false;
    }

    update(entities: Entity[], _delta: number): void {
        // B 键上升沿：打开/关闭 UI
        const bDown = this.bKey?.isDown ?? false;
        if (bDown && !this.previousBDown) {
            this.toggleUI(entities);
        }
        this.previousBDown = bDown;

        if (!this.isOpen || !this.targetEntity) {
            this.hideAll();
            return;
        }

        this.renderGrid();
        this.renderHeldItem();
    }

    // ============================================================
    // UI 开关
    // ============================================================

    private toggleUI(entities: Entity[]): void {
        if (this.isOpen) {
            this.returnHeldItem();
            this.isOpen = false;
            this.targetEntity = null;
        } else {
            const entity = entities.find(e => e.hasComponent('inventory') && e.hasComponent('player'));
            if (entity) {
                this.isOpen = true;
                this.targetEntity = entity;
            }
        }
    }

    /** 关闭 UI 时若手中有物品，尝试放回 */
    private returnHeldItem(): void {
        if (!this.heldItem || !this.targetEntity) return;

        const inventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;

        // 优先放回原格子
        if (this.heldFromSlot >= 0 && this.heldFromSlot < inventory.capacity && inventory.items[this.heldFromSlot] === null) {
            inventory.items[this.heldFromSlot] = { ...this.heldItem };
        } else {
            // 找空格子
            const emptySlot = inventory.items.findIndex(item => item === null);
            if (emptySlot >= 0) {
                inventory.items[emptySlot] = { ...this.heldItem };
            } else {
                console.warn('[InventoryUISystem] 关闭UI时库存已满，手持物品丢失');
            }
        }

        this.heldItem = null;
        this.heldFromSlot = -1;
    }

    // ============================================================
    // 渲染
    // ============================================================

    private renderGrid(): void {
        if (!this.targetEntity) return;

        const inventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;

        // 绘制背景面板
        this.panel.clear();
        this.panel.fillStyle(0x1a1a2e, 0.95);
        this.panel.fillRoundedRect(
            this.gridX - this.PADDING,
            this.gridY - this.PADDING,
            this.panelW,
            this.panelH,
            8
        );
        this.panel.lineStyle(2, 0x444466, 1);
        this.panel.strokeRoundedRect(
            this.gridX - this.PADDING,
            this.gridY - this.PADDING,
            this.panelW,
            this.panelH,
            8
        );

        // 绘制格子和物品
        this.itemGraphics.clear();
        let textIdx = 0;

        for (let i = 0; i < inventory.capacity; i++) {
            const { x, y } = this.getSlotPosition(i);

            // 格子背景
            this.itemGraphics.fillStyle(0x2a2a3e, 1);
            this.itemGraphics.fillRect(x, y, this.CELL_SIZE, this.CELL_SIZE);

            // 格子边框
            this.itemGraphics.lineStyle(1, 0x555577, 1);
            this.itemGraphics.strokeRect(x, y, this.CELL_SIZE, this.CELL_SIZE);

            // 物品方块
            const item = inventory.items[i];
            if (item) {
                const color = this.itemColors[item.itemId] ?? 0xaaaaaa;
                this.itemGraphics.fillStyle(color, 1);
                this.itemGraphics.fillRect(x + 4, y + 4, this.CELL_SIZE - 8, this.CELL_SIZE - 8);

                // 数量文字
                if (textIdx < this.quantityTexts.length) {
                    const text = this.quantityTexts[textIdx];
                    text.setPosition(x + this.CELL_SIZE - 3, y + this.CELL_SIZE - 2);
                    text.setText(item.quantity > 1 ? String(item.quantity) : '');
                    text.visible = true;
                    textIdx++;
                }
            }
        }

        // 隐藏未使用的文字
        for (let i = textIdx; i < this.quantityTexts.length; i++) {
            this.quantityTexts[i].visible = false;
        }

        this.panel.visible = true;
        this.itemGraphics.visible = true;
    }

    private renderHeldItem(): void {
        if (!this.heldItem) {
            this.heldGraphics.visible = false;
            this.heldText.visible = false;
            return;
        }

        const pointer = this.scene.input.activePointer;
        const size = this.CELL_SIZE - 8;
        const hx = pointer.x - size / 2;
        const hy = pointer.y - size / 2;

        this.heldGraphics.clear();
        this.heldGraphics.fillStyle(this.itemColors[this.heldItem.itemId] ?? 0xaaaaaa, 0.9);
        this.heldGraphics.fillRect(hx, hy, size, size);

        // 半透明边框
        this.heldGraphics.lineStyle(2, 0xffffff, 0.6);
        this.heldGraphics.strokeRect(hx, hy, size, size);

        this.heldGraphics.visible = true;

        if (this.heldItem.quantity > 1) {
            this.heldText.setPosition(pointer.x + size / 2 - 2, pointer.y + size / 2 - 2);
            this.heldText.setText(String(this.heldItem.quantity));
            this.heldText.visible = true;
        } else {
            this.heldText.visible = false;
        }
    }

    private hideAll(): void {
        this.panel.visible = false;
        this.itemGraphics.visible = false;
        this.heldGraphics.visible = false;
        this.heldText.visible = false;
        for (const text of this.quantityTexts) {
            text.visible = false;
        }
    }

    private getSlotPosition(slot: number): { x: number; y: number } {
        const col = slot % this.COLS;
        const row = Math.floor(slot / this.COLS);
        return {
            x: this.gridX + col * (this.CELL_SIZE + this.GAP),
            y: this.gridY + row * (this.CELL_SIZE + this.GAP),
        };
    }

    // ============================================================
    // 鼠标交互
    // ============================================================

    private onPointerDown(pointer: Input.Pointer): void {
        if (!this.isOpen || !this.targetEntity) return;

        const slot = this.getSlotAt(pointer.x, pointer.y);
        if (slot < 0) return;

        const inventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;

        if (pointer.button === 0) {
            this.handleLeftClick(inventory, itemsMap, slot);
        } else if (pointer.button === 2) {
            this.handleRightClick(inventory, itemsMap, slot);
        }
    }

    /** 将屏幕坐标映射到格子索引，-1 表示未命中 */
    private getSlotAt(screenX: number, screenY: number): number {
        const relX = screenX - this.gridX;
        const relY = screenY - this.gridY;

        for (let i = 0; i < this.COLS * this.ROWS; i++) {
            const { x, y } = this.getSlotPosition(i);
            const localX = x - this.gridX;
            const localY = y - this.gridY;
            if (
                relX >= localX &&
                relX < localX + this.CELL_SIZE &&
                relY >= localY &&
                relY < localY + this.CELL_SIZE
            ) {
                return i;
            }
        }
        return -1;
    }

    // ============================================================
    // 左键逻辑
    // ============================================================

    private handleLeftClick(
        inventory: InventoryComponent,
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number
    ): void {
        const slotItem = inventory.items[slot];

        if (!this.heldItem) {
            // 空手 → 拿起全部
            if (slotItem) {
                this.heldItem = { ...slotItem };
                this.heldFromSlot = slot;
                inventory.items[slot] = null;
            }
        } else {
            // 拿着物品
            if (!slotItem) {
                // 空格子 → 全部放入
                inventory.items[slot] = { ...this.heldItem };
                this.clearHeld();
            } else if (slotItem.itemId === this.heldItem.itemId) {
                // 相同物品 → 尝试堆叠全部
                this.tryStackAll(inventory, itemsMap, slot);
            } else {
                // 不同物品 → 交换
                this.swapWithSlot(inventory, slot);
            }
        }
    }

    // ============================================================
    // 右键逻辑
    // ============================================================

    private handleRightClick(
        inventory: InventoryComponent,
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number
    ): void {
        const slotItem = inventory.items[slot];

        if (!this.heldItem) {
            // 空手 → 拆分拿起一半（奇数多拿1）
            if (slotItem) {
                const half = Math.ceil(slotItem.quantity / 2);
                this.heldItem = { itemId: slotItem.itemId, quantity: half };
                this.heldFromSlot = slot;
                slotItem.quantity -= half;
                if (slotItem.quantity <= 0) {
                    inventory.items[slot] = null;
                }
            }
        } else {
            // 拿着物品
            if (!slotItem) {
                // 空格子 → 只放1个
                this.placeOne(inventory, slot);
            } else if (slotItem.itemId === this.heldItem.itemId) {
                // 相同物品 → 尝试堆叠1个
                this.tryStackOne(inventory, itemsMap, slot);
            } else {
                // 不同物品 → 与左键相同（交换全部）
                this.swapWithSlot(inventory, slot);
            }
        }
    }

    // ============================================================
    // 辅助方法
    // ============================================================

    /** 尝试将手中全部物品堆叠到目标格子 */
    private tryStackAll(
        inventory: InventoryComponent,
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number
    ): void {
        if (!this.heldItem) return;

        const def = itemsMap?.[this.heldItem.itemId];
        const slotItem = inventory.items[slot];
        if (!slotItem || slotItem.itemId !== this.heldItem.itemId) return;

        if (def?.stackable) {
            const space = def.maxStack - slotItem.quantity;
            if (space > 0) {
                const transfer = Math.min(this.heldItem.quantity, space);
                slotItem.quantity += transfer;
                this.heldItem.quantity -= transfer;
                if (this.heldItem.quantity <= 0) {
                    this.clearHeld();
                }
                return;
            }
        }

        // 不可堆叠或已满 → 交换
        this.swapWithSlot(inventory, slot);
    }

    /** 尝试将手中1个物品堆叠到目标格子 */
    private tryStackOne(
        inventory: InventoryComponent,
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number
    ): void {
        if (!this.heldItem) return;

        const def = itemsMap?.[this.heldItem.itemId];
        const slotItem = inventory.items[slot];
        if (!slotItem || slotItem.itemId !== this.heldItem.itemId) return;

        if (def?.stackable) {
            const space = def.maxStack - slotItem.quantity;
            if (space > 0) {
                slotItem.quantity++;
                this.heldItem.quantity--;
                if (this.heldItem.quantity <= 0) {
                    this.clearHeld();
                }
                return;
            }
        }

        // 不可堆叠或已满 → 交换
        this.swapWithSlot(inventory, slot);
    }

    /** 向目标格子放入1个物品 */
    private placeOne(inventory: InventoryComponent, slot: number): void {
        if (!this.heldItem) return;

        inventory.items[slot] = { itemId: this.heldItem.itemId, quantity: 1 };
        this.heldItem.quantity--;

        if (this.heldItem.quantity <= 0) {
            this.clearHeld();
        }
    }

    /** 将手中物品与目标格子交换 */
    private swapWithSlot(inventory: InventoryComponent, slot: number): void {
        if (!this.heldItem) return;

        const temp = inventory.items[slot];
        inventory.items[slot] = { ...this.heldItem };

        if (temp) {
            this.heldItem = { ...temp };
            this.heldFromSlot = slot;
        } else {
            this.clearHeld();
        }
    }

    private clearHeld(): void {
        this.heldItem = null;
        this.heldFromSlot = -1;
    }
}
