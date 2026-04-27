import * as ex from "excalibur";
import { InventoryComponent } from "../components/inventory-component";
import { EquipmentComponent } from "../components/equipment-component";
import { EquipmentSlotType } from "../item-base";
import { InventoryPane } from "./inventory-pane";
import { HoverTooltip } from "./hover-tooltip";
import { getSharedInventoryDragManager } from "./inventory-drag-manager";
import { ItemBase } from "../item-base";
import { InventorySystem } from "../systems/inventory-system";

type EquipmentSlotPaneConfig = {
    slotType: EquipmentSlotType;
    label: string;
    x: number;
    y: number;
};

export class CharacterInventoryUI extends ex.ScreenElement {
    private inventory: InventoryComponent | null = null;
    private equipment: EquipmentComponent | null = null;
    private owner: ex.Entity | null = null;
    private readonly dragManager;
    private isVisible: boolean = false;
    private readonly hoverTooltip: HoverTooltip;
    private readonly SLOT_SIZE = 48;
    private readonly SLOT_MARGIN = 4;
    private readonly INV_GRID_W = 8;
    private readonly INV_GRID_H = 5;
    private readonly INV_START_X = -206;
    private readonly INV_START_Y = -20;
    private readonly INV_HEADER_Y = -55;
    private readonly EQ_START_X = -128;
    private readonly EQ_START_Y = -155;
    private readonly EQ_HEADER_Y = -190;
    private readonly PANEL_WIDTH: number;
    private readonly PANEL_HEIGHT: number;
    private readonly inventoryPane: InventoryPane;
    private readonly equipmentSlotPanes: Map<EquipmentSlotType, InventoryPane> = new Map();
    private readonly equipmentSlotConfigs: EquipmentSlotPaneConfig[] = [
        { slotType: EquipmentSlotType.Weapon, label: "武器", x: 0, y: 0 },
        { slotType: EquipmentSlotType.Helmet, label: "头盔", x: 56, y: 0 },
        { slotType: EquipmentSlotType.Armor, label: "护甲", x: 112, y: 0 },
        { slotType: EquipmentSlotType.Boots, label: "靴子", x: 168, y: 0 },
        { slotType: EquipmentSlotType.Accessory, label: "饰品", x: 224, y: 0 },
    ];
    private background: ex.Rectangle;

    constructor(engine: ex.Engine) {
        const invPixelW = 8 * (48 + 4) - 4;
        const invPixelH = 5 * (48 + 4) - 4;
        const eqPixelW = 5 * 48 + 4 * 8;
        const panelW = Math.max(invPixelW, eqPixelW) + 40;
        const panelH = invPixelH + 140 + 40;

        super({
            x: 400,
            y: 300,
            width: panelW,
            height: panelH,
            anchor: ex.Vector.Half,
            z: 1000
        });

        this.PANEL_WIDTH = panelW;
        this.PANEL_HEIGHT = panelH;

        this.background = new ex.Rectangle({
            width: panelW,
            height: panelH,
            color: ex.Color.fromHex("#2a2a2a"),
            strokeColor: ex.Color.fromHex("#b8a98d"),
            lineWidth: 2
        });
        this.graphics.use(this.background);
        this.graphics.hide();

        this.inventoryPane = new InventoryPane({
            title: "背包",
            startX: -206,
            startY: -70,
            headerY: -100,
            slotSize: 48,
            slotMargin: 4,
            gridWidth: 8,
            gridHeight: 5,
            zBase: 1001,
            style: InventoryPane.createStyle({})
        });
        this.inventoryPane.attachTo(this);

        for (const cfg of this.equipmentSlotConfigs) {
            const pane = new InventoryPane({
                title: cfg.label,
                startX: -128 + cfg.x,
                startY: -170 + cfg.y,
                headerY: -190 + cfg.y - 18,
                slotSize: 48,
                slotMargin: 4,
                gridWidth: 1,
                gridHeight: 1,
                zBase: 1001,
                style: InventoryPane.createStyle({
                    slotColor: ex.Color.fromHex("#4a3a2a"),
                    slotStrokeColor: ex.Color.fromHex("#d0a060")
                })
            });
            pane.attachTo(this);
            this.equipmentSlotPanes.set(cfg.slotType, pane);
        }

        this.dragManager = getSharedInventoryDragManager(engine);

        this.hoverTooltip = new HoverTooltip({
            width: 240,
            height: 80,
            textOffsetX: 10,
            textOffsetY: 10
        });
        this.hoverTooltip.attachTo(this);
    }

    setInventory(inventory: InventoryComponent) {
        if (this.inventory === inventory) return;
        this.inventory = inventory;
        this.inventoryPane.setContainer(inventory);
        if (this.isVisible) this.updateDisplay();
    }

    setEquipment(equipment: EquipmentComponent) {
        if (this.equipment === equipment) return;
        this.equipment = equipment;
        for (const cfg of this.equipmentSlotConfigs) {
            const pane = this.equipmentSlotPanes.get(cfg.slotType)!;
            pane.setContainer(equipment.getSlot(cfg.slotType));
        }
        if (this.isVisible) this.updateDisplay();
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
        this.registerPanes();
        this.updateDisplay();
    }

    hide() {
        this.isVisible = false;
        this.hideHover();
        this.unregisterPanes();
        this.graphics.hide();
        this.inventoryPane.clear();
        for (const pane of this.equipmentSlotPanes.values()) {
            pane.clear();
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    override onPostUpdate(_engine: ex.Engine, _delta: number): void {
        if (this.isVisible) {
            this.updateDisplay();
        }
    }

    private showHover(item: ItemBase, localPos: ex.Vector) {
        let text = `${item.name}\n${item.description}\n数量: ${item.quantity}`;
        if (item.equipmentStats) {
            const stats: string[] = [];
            if (item.equipmentStats.attack) stats.push(`攻击 +${item.equipmentStats.attack}`);
            if (item.equipmentStats.defense) stats.push(`防御 +${item.equipmentStats.defense}`);
            if (stats.length > 0) {
                text += `\n${stats.join("  ")}`;
            }
        }
        this.hoverTooltip.show(text, localPos, ex.vec(110, 60));
    }

    private hideHover() {
        this.hoverTooltip.hide();
    }

    private updateDisplay() {
        if (!this.isVisible) return;
        this.inventoryPane.render();
        for (const pane of this.equipmentSlotPanes.values()) {
            pane.render();
        }
    }

    private registerPanes() {
        if (!this.inventory || !this.equipment) return;

        this.dragManager.registerPane({
            id: "char-inv-backpack",
            pane: this.inventoryPane,
            getContainer: () => this.inventory,
            screenToLocal: (screenPos) => screenPos.sub(this.pos),
            localToScreen: (localPos) => this.pos.add(localPos),
            onHover: (ctx) => {
                if (!ctx.item) {
                    this.hideHover();
                    return;
                }
                this.showHover(ctx.item, ctx.localPos);
            },
            onRightClick: (ctx) => {
                if (!this.inventory || !this.owner || !this.equipment) return;
                const item = ctx.item;
                if (item.type === "equipment" && item.equipmentStats) {
                    const targetSlot = this.equipment.getSlot(item.equipmentStats.slot);
                    const existing = Array.from(targetSlot.items.values())[0];
                    if (existing) {
                        const moved = InventorySystem.addItem(this.inventory, existing);
                        if (!moved) {
                            console.log("背包已满，无法卸下当前装备");
                            (ctx.event as any).preventDefault?.();
                            return;
                        }
                        targetSlot.items.delete(existing.uid);
                        targetSlot.version++;
                    }
                    InventorySystem.removeItem(this.inventory, item.uid, item.quantity);
                    const clone = { ...item, uid: item.uid, inventoryX: 0, inventoryY: 0 };
                    targetSlot.items.set(clone.uid, clone);
                    targetSlot.version++;
                    this.inventory.version++;
                    console.log(`装备了 ${item.name}`);
                    this.updateDisplay();
                    (ctx.event as any).preventDefault?.();
                    return;
                }
                InventorySystem.addUseRequest(this.inventory, item.uid, this.owner);
                console.log(`标记道具使用请求：${item.name}`);
                (ctx.event as any).preventDefault?.();
                this.updateDisplay();
            },
            onChanged: () => this.updateDisplay(),
            isActive: () => this.isVisible
        });

        for (const cfg of this.equipmentSlotConfigs) {
            const pane = this.equipmentSlotPanes.get(cfg.slotType)!;
            const slotContainer = this.equipment.getSlot(cfg.slotType);
            this.dragManager.registerPane({
                id: `char-inv-slot-${cfg.slotType}`,
                pane: pane,
                getContainer: () => slotContainer,
                screenToLocal: (screenPos) => screenPos.sub(this.pos),
                localToScreen: (localPos) => this.pos.add(localPos),
                onHover: (ctx) => {
                    if (!ctx.item) {
                        this.hideHover();
                        return;
                    }
                    this.showHover(ctx.item, ctx.localPos);
                },
                onRightClick: (ctx) => {
                    if (!this.inventory || !this.equipment) return;
                    const item = ctx.item;
                    const slot = this.equipment.getSlot(cfg.slotType);
                    const moved = InventorySystem.addItem(this.inventory, item);
                    if (moved) {
                        slot.items.delete(item.uid);
                        slot.version++;
                        this.inventory.version++;
                        console.log(`卸下了 ${item.name}`);
                    } else {
                        console.log("背包已满，无法卸下");
                    }
                    this.updateDisplay();
                    (ctx.event as any).preventDefault?.();
                },
                onChanged: () => this.updateDisplay(),
                isActive: () => this.isVisible
            });
        }
    }


    private unregisterPanes() {
        this.dragManager.unregisterPane("char-inv-backpack");
        for (const cfg of this.equipmentSlotConfigs) {
            this.dragManager.unregisterPane(`char-inv-slot-${cfg.slotType}`);
        }
    }
}