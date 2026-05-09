import { Scene, GameObjects, Input } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { InventoryComponent, ItemDefinition, InventoryItem } from '../ecs/Component';

export class InventoryUISystem extends System {
    private isOpen = false;
    private previousBDown = false;
    private bKey: Input.Keyboard.Key | null = null;

    private heldItem: InventoryItem | null = null;
    private heldFromSlot = -1;
    private targetEntity: Entity | null = null;

    private panel!: GameObjects.Graphics;
    private itemGraphics!: GameObjects.Graphics;
    private heldGraphics!: GameObjects.Graphics;
    private quantityTexts: GameObjects.Text[] = [];
    private heldText!: GameObjects.Text;

    // Tooltip 元素
    private tooltipPanel!: GameObjects.Graphics;
    private tooltipName!: GameObjects.Text;
    private tooltipType!: GameObjects.Text;
    private tooltipDesc!: GameObjects.Text;
    private tooltipStats!: GameObjects.Text;

    private readonly COLS = 5;
    private readonly ROWS = 4;
    private readonly CELL_SIZE = 40;
    private readonly GAP = 4;
    private readonly PADDING = 12;

    private panelW = 0;
    private panelH = 0;

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
        this.panelW = this.COLS * this.CELL_SIZE + (this.COLS - 1) * this.GAP + this.PADDING * 2;
        this.panelH = this.ROWS * this.CELL_SIZE + (this.ROWS - 1) * this.GAP + this.PADDING * 2;

        this.panel = this.scene.add.graphics();
        this.panel.setDepth(1000);
        this.panel.visible = false;

        this.itemGraphics = this.scene.add.graphics();
        this.itemGraphics.setDepth(1001);
        this.itemGraphics.visible = false;

        this.heldGraphics = this.scene.add.graphics();
        this.heldGraphics.setDepth(1002);
        this.heldGraphics.visible = false;

        for (let i = 0; i < 20; i++) {
            const text = this.scene.add.text(0, 0, '', {
                fontSize: '12px', color: '#ffffff',
                stroke: '#000000', strokeThickness: 2,
            });
            text.setDepth(1001);
            text.setOrigin(1, 1);
            text.visible = false;
            this.quantityTexts.push(text);
        }

        this.heldText = this.scene.add.text(0, 0, '', {
            fontSize: '12px', color: '#ffffff',
            stroke: '#000000', strokeThickness: 2,
        });
        this.heldText.setDepth(1002);
        this.heldText.setOrigin(1, 1);
        this.heldText.visible = false;

        // Tooltip（depth 高于血条 9998）
        this.tooltipPanel = this.scene.add.graphics();
        this.tooltipPanel.setDepth(10000);
        this.tooltipPanel.visible = false;

        const textRes = 2; // 提高渲染分辨率，减少高 zoom 下的模糊

        this.tooltipName = this.scene.add.text(0, 0, '', {
            fontSize: '14px', color: '#ffffff',
            resolution: textRes,
        });
        this.tooltipName.setDepth(10001);
        this.tooltipName.setOrigin(0, 0);
        this.tooltipName.visible = false;

        this.tooltipType = this.scene.add.text(0, 0, '', {
            fontSize: '10px', color: '#aaaaaa',
            resolution: textRes,
        });
        this.tooltipType.setDepth(10001);
        this.tooltipType.setOrigin(0, 0);
        this.tooltipType.visible = false;

        this.tooltipDesc = this.scene.add.text(0, 0, '', {
            fontSize: '11px', color: '#cccccc',
            resolution: textRes,
        });
        this.tooltipDesc.setDepth(10001);
        this.tooltipDesc.setOrigin(0, 0);
        this.tooltipDesc.visible = false;

        this.tooltipStats = this.scene.add.text(0, 0, '', {
            fontSize: '11px', color: '#88cc88',
            resolution: textRes,
        });
        this.tooltipStats.setDepth(10001);
        this.tooltipStats.setOrigin(0, 0);
        this.tooltipStats.visible = false;
    }

    update(entities: Entity[], _delta: number): void {
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
        this.renderTooltip();
    }

    /** 将屏幕像素坐标转换为世界坐标 — 使用 Phaser 内置方法 */
    private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
        const cam = this.scene.cameras.main;
        const worldPoint = cam.getWorldPoint(screenX, screenY);
        return { x: worldPoint.x, y: worldPoint.y };
    }

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

    private returnHeldItem(): void {
        if (!this.heldItem || !this.targetEntity) return;
        const inventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        if (this.heldFromSlot >= 0 && this.heldFromSlot < inventory.capacity && inventory.items[this.heldFromSlot] === null) {
            inventory.items[this.heldFromSlot] = { ...this.heldItem };
        } else {
            const emptySlot = inventory.items.findIndex(item => item === null);
            if (emptySlot >= 0) {
                inventory.items[emptySlot] = { ...this.heldItem };
            }
        }
        this.heldItem = null;
        this.heldFromSlot = -1;
    }

    private renderGrid(): void {
        if (!this.targetEntity) return;

        const inventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        const cam = this.scene.cameras.main;
        const zoom = cam.zoom || 1;

        const cx = cam.midPoint.x;
        const cy = cam.midPoint.y;
        const gridX = cx - this.panelW / 2;
        const gridY = cy - this.panelH / 2;

        // 绘制背景面板
        this.panel.clear();
        this.panel.fillStyle(0x1a1a2e, 0.95);
        this.panel.fillRoundedRect(
            gridX - this.PADDING,
            gridY - this.PADDING,
            this.panelW,
            this.panelH,
            8
        );
        this.panel.lineStyle(2, 0x444466, 1);
        this.panel.strokeRoundedRect(
            gridX - this.PADDING,
            gridY - this.PADDING,
            this.panelW,
            this.panelH,
            8
        );

        // 绘制格子和物品
        this.itemGraphics.clear();
        let textIdx = 0;

        for (let i = 0; i < inventory.capacity; i++) {
            const slotX = gridX + (i % this.COLS) * (this.CELL_SIZE + this.GAP);
            const slotY = gridY + Math.floor(i / this.COLS) * (this.CELL_SIZE + this.GAP);

            // 格子背景
            this.itemGraphics.fillStyle(0x2a2a3e, 1);
            this.itemGraphics.fillRect(slotX, slotY, this.CELL_SIZE, this.CELL_SIZE);

            // 格子边框
            this.itemGraphics.lineStyle(1, 0x555577, 1);
            this.itemGraphics.strokeRect(slotX, slotY, this.CELL_SIZE, this.CELL_SIZE);

            // 物品方块
            const item = inventory.items[i];
            if (item) {
                const color = this.itemColors[item.itemId] ?? 0xaaaaaa;
                this.itemGraphics.fillStyle(color, 1);
                this.itemGraphics.fillRect(slotX + 4, slotY + 4, this.CELL_SIZE - 8, this.CELL_SIZE - 8);

                if (textIdx < this.quantityTexts.length) {
                    const text = this.quantityTexts[textIdx];
                    text.setPosition(slotX + this.CELL_SIZE - 3, slotY + this.CELL_SIZE - 2);
                    text.setText(item.quantity > 1 ? String(item.quantity) : '');
                    text.visible = true;
                    textIdx++;
                }
            }
        }

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
        const { x: worldX, y: worldY } = this.screenToWorld(pointer.x, pointer.y);
        const size = this.CELL_SIZE - 8;
        const hx = worldX - size / 2;
        const hy = worldY - size / 2;

        this.heldGraphics.clear();
        this.heldGraphics.fillStyle(this.itemColors[this.heldItem.itemId] ?? 0xaaaaaa, 0.9);
        this.heldGraphics.fillRect(hx, hy, size, size);
        this.heldGraphics.lineStyle(2, 0xffffff, 0.6);
        this.heldGraphics.strokeRect(hx, hy, size, size);
        this.heldGraphics.visible = true;

        if (this.heldItem.quantity > 1) {
            this.heldText.setPosition(worldX + size / 2 - 2, worldY + size / 2 - 2);
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
        this.tooltipPanel.visible = false;
        this.tooltipName.visible = false;
        this.tooltipType.visible = false;
        this.tooltipDesc.visible = false;
        this.tooltipStats.visible = false;
    }

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

    private getSlotAt(screenX: number, screenY: number): number {
        const { x: worldX, y: worldY } = this.screenToWorld(screenX, screenY);
        const cam = this.scene.cameras.main;
        const gridX = cam.midPoint.x - this.panelW / 2;
        const gridY = cam.midPoint.y - this.panelH / 2;
        const relX = worldX - gridX;
        const relY = worldY - gridY;

        for (let i = 0; i < this.COLS * this.ROWS; i++) {
            const slotX = (i % this.COLS) * (this.CELL_SIZE + this.GAP);
            const slotY = Math.floor(i / this.COLS) * (this.CELL_SIZE + this.GAP);
            if (
                relX >= slotX &&
                relX < slotX + this.CELL_SIZE &&
                relY >= slotY &&
                relY < slotY + this.CELL_SIZE
            ) {
                return i;
            }
        }
        return -1;
    }

    private handleLeftClick(
        inventory: InventoryComponent,
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number
    ): void {
        const slotItem = inventory.items[slot];
        if (!this.heldItem) {
            if (slotItem) {
                this.heldItem = { ...slotItem };
                this.heldFromSlot = slot;
                inventory.items[slot] = null;
            }
        } else {
            if (!slotItem) {
                inventory.items[slot] = { ...this.heldItem };
                this.clearHeld();
            } else if (slotItem.itemId === this.heldItem.itemId) {
                this.tryStackAll(inventory, itemsMap, slot);
            } else {
                this.swapWithSlot(inventory, slot);
            }
        }
    }

    private handleRightClick(
        inventory: InventoryComponent,
        itemsMap: Record<string, ItemDefinition> | undefined,
        slot: number
    ): void {
        const slotItem = inventory.items[slot];
        if (!this.heldItem) {
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
            if (!slotItem) {
                this.placeOne(inventory, slot);
            } else if (slotItem.itemId === this.heldItem.itemId) {
                this.tryStackOne(inventory, itemsMap, slot);
            } else {
                this.swapWithSlot(inventory, slot);
            }
        }
    }

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
        this.swapWithSlot(inventory, slot);
    }

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
        this.swapWithSlot(inventory, slot);
    }

    private placeOne(inventory: InventoryComponent, slot: number): void {
        if (!this.heldItem) return;
        inventory.items[slot] = { itemId: this.heldItem.itemId, quantity: 1 };
        this.heldItem.quantity--;
        if (this.heldItem.quantity <= 0) {
            this.clearHeld();
        }
    }

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

    // ============================================================
    // Tooltip
    // ============================================================

    private renderTooltip(): void {
        if (!this.targetEntity) {
            this.hideTooltip();
            return;
        }

        const pointer = this.scene.input.activePointer;
        const slot = this.getSlotAt(pointer.x, pointer.y);

        if (slot < 0) {
            this.hideTooltip();
            return;
        }

        const inventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        const item = inventory.items[slot];
        if (!item) {
            this.hideTooltip();
            return;
        }

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;
        const def = itemsMap?.[item.itemId];
        if (!def) {
            this.hideTooltip();
            return;
        }

        const { x: worldX, y: worldY } = this.screenToWorld(pointer.x, pointer.y);

        // 构建 Tooltip 文本
        const nameText = def.name;
        const typeText = this.typeLabel(def.type);
        const descText = def.description;

        let statsText = '';
        if (def.type === 'equipment' && def.equipment) {
            const attrs: string[] = [];
            if (def.equipment.attack) attrs.push(`攻击 +${def.equipment.attack}`);
            if (def.equipment.defense) attrs.push(`防御 +${def.equipment.defense}`);
            attrs.push(`部位: ${this.slotLabel(def.equipment.slot)}`);
            statsText = attrs.join('  ');
        } else if (def.type === 'consumable' && def.useEffect) {
            statsText = `效果: ${this.effectLabel(def.useEffect.type)} ${def.useEffect.value}`;
        } else if (def.value) {
            statsText = `价值: ${def.value} 金币`;
        }

        // 测量文本尺寸（用 Phaser Text 的 getBounds 不如先设置再测，这里用估算）
        const lineHeight = 14;
        const pad = 8;
        const maxTextW = Math.max(
            nameText.length * 9,
            typeText.length * 6,
            descText.length * 7,
            statsText.length * 7
        );
        const tooltipW = Math.max(maxTextW + pad * 2, 120);
        const tooltipH = (statsText ? 4 : 3) * lineHeight + pad * 2;

        // 边界检查：默认显示在鼠标右下方，超出边界则调整
        let tx = worldX + 16;
        let ty = worldY + 16;
        const cam = this.scene.cameras.main;
        const camRight = cam.midPoint.x + (cam.width / 2 / (cam.zoom || 1));
        const camBottom = cam.midPoint.y + (cam.height / 2 / (cam.zoom || 1));
        if (tx + tooltipW > camRight) {
            tx = worldX - tooltipW - 8;
        }
        if (ty + tooltipH > camBottom) {
            ty = worldY - tooltipH - 8;
        }

        // 绘制背景
        this.tooltipPanel.clear();
        this.tooltipPanel.fillStyle(0x111122, 0.95);
        this.tooltipPanel.fillRoundedRect(tx, ty, tooltipW, tooltipH, 4);
        this.tooltipPanel.lineStyle(1, 0x666688, 1);
        this.tooltipPanel.strokeRoundedRect(tx, ty, tooltipW, tooltipH, 4);
        this.tooltipPanel.visible = true;

        // 名称（带颜色）
        this.tooltipName.setPosition(tx + pad, ty + pad);
        this.tooltipName.setText(nameText);
        this.tooltipName.setColor(this.getRarityColor(def.type));
        this.tooltipName.visible = true;

        // 类型
        this.tooltipType.setPosition(tx + pad, ty + pad + lineHeight);
        this.tooltipType.setText(`[${typeText}]`);
        this.tooltipType.visible = true;

        // 描述
        this.tooltipDesc.setPosition(tx + pad, ty + pad + lineHeight * 2);
        this.tooltipDesc.setText(descText);
        this.tooltipDesc.visible = true;

        // 属性
        if (statsText) {
            this.tooltipStats.setPosition(tx + pad, ty + pad + lineHeight * 3);
            this.tooltipStats.setText(statsText);
            this.tooltipStats.visible = true;
        } else {
            this.tooltipStats.visible = false;
        }
    }

    private hideTooltip(): void {
        this.tooltipPanel.visible = false;
        this.tooltipName.visible = false;
        this.tooltipType.visible = false;
        this.tooltipDesc.visible = false;
        this.tooltipStats.visible = false;
    }

    private typeLabel(type: string): string {
        switch (type) {
            case 'consumable': return '消耗品';
            case 'equipment': return '装备';
            case 'material': return '材料';
            default: return type;
        }
    }

    private slotLabel(slot: string): string {
        switch (slot) {
            case 'weapon': return '武器';
            case 'armor': return '护甲';
            case 'helmet': return '头盔';
            default: return slot;
        }
    }

    private effectLabel(effect: string): string {
        switch (effect) {
            case 'heal': return '恢复生命';
            default: return effect;
        }
    }

    private getRarityColor(type: string): string {
        switch (type) {
            case 'equipment': return '#ffaa44';
            case 'consumable': return '#44aaff';
            case 'material': return '#aaaaaa';
            default: return '#ffffff';
        }
    }

    private clearHeld(): void {
        this.heldItem = null;
        this.heldFromSlot = -1;
    }
}
