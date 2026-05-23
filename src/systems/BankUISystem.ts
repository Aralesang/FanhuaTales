import { Scene, GameObjects, Input } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { FontConfig } from '../config/FontConfig';
import {
    InventoryComponent, ItemDefinition, InventoryItem,
    SettingsComponent, UIStateComponent, BankComponent
} from '../ecs/Component';
import { InventorySystem } from './InventorySystem';

export class BankUISystem extends System {
    private isOpen = false;
    private targetEntity: Entity | null = null;

    private panel!: GameObjects.Graphics;
    private itemGraphics!: GameObjects.Graphics;
    private itemSprites: GameObjects.Sprite[] = [];
    private quantityTexts: GameObjects.Text[] = [];

    // 银行面板文本
    private bankTitleText!: GameObjects.Text;
    private bankBalanceText!: GameObjects.Text;
    private withdrawOneText!: GameObjects.Text;
    private withdrawAllText!: GameObjects.Text;
    private withdrawOneBg!: GameObjects.Graphics;
    private withdrawAllBg!: GameObjects.Graphics;

    // 背包面板银行余额显示
    private playerBankBalanceBg!: GameObjects.Graphics;
    private playerBankBalanceText!: GameObjects.Text;

    private readonly COLS = 5;
    private readonly ROWS = 4;
    private readonly BASE_CELL_SIZE = 40;
    private readonly BASE_GAP = 4;
    private readonly BASE_PADDING = 12;

    private uiScale = 1.0;

    constructor(scene: Scene) {
        super(scene);
        this.initUI();
        scene.input.on('pointerdown', this.onPointerDown, this);
    }

    private initUI(): void {
        this.panel = this.scene.add.graphics();
        this.panel.setDepth(1000);
        this.panel.visible = false;

        this.itemGraphics = this.scene.add.graphics();
        this.itemGraphics.setDepth(1001);
        this.itemGraphics.visible = false;

        // 道具图标精灵池：玩家库存 20 个槽位
        for (let i = 0; i < 20; i++) {
            const sprite = this.scene.add.sprite(0, 0, 'item_notfind');
            sprite.setDepth(1001);
            sprite.setOrigin(0, 0);
            sprite.visible = false;
            this.itemSprites.push(sprite);
        }

        for (let i = 0; i < 40; i++) {
            const text = this.createText(0, 0, '', {
                fontSize: FontConfig.small.size, color: '#ffffff',
                fontFamily: FontConfig.small.family,
            });
            text.setDepth(1002);
            text.setOrigin(1, 1);
            text.visible = false;
            this.quantityTexts.push(text);
        }

        // 银行面板文本
        this.bankTitleText = this.createText(0, 0, '银行', {
            fontSize: FontConfig.large.size, color: '#ffcc44',
            fontFamily: FontConfig.large.family,
        });
        this.bankTitleText.setDepth(1001);
        this.bankTitleText.setOrigin(0.5, 0);
        this.bankTitleText.visible = false;

        this.bankBalanceText = this.createText(0, 0, '', {
            fontSize: FontConfig.large.size, color: '#ffffff',
            fontFamily: FontConfig.large.family,
        });
        this.bankBalanceText.setDepth(1001);
        this.bankBalanceText.setOrigin(0.5, 0);
        this.bankBalanceText.visible = false;

        this.withdrawOneBg = this.scene.add.graphics();
        this.withdrawOneBg.setDepth(1001);
        this.withdrawOneBg.visible = false;

        this.withdrawOneText = this.createText(0, 0, '取出 1 个', {
            fontSize: FontConfig.small.size, color: '#ffffff',
            fontFamily: FontConfig.small.family,
        });
        this.withdrawOneText.setDepth(1002);
        this.withdrawOneText.setOrigin(0.5, 0.5);
        this.withdrawOneText.visible = false;

        this.withdrawAllBg = this.scene.add.graphics();
        this.withdrawAllBg.setDepth(1001);
        this.withdrawAllBg.visible = false;

        this.withdrawAllText = this.createText(0, 0, '取出全部', {
            fontSize: FontConfig.small.size, color: '#ffffff',
            fontFamily: FontConfig.small.family,
        });
        this.withdrawAllText.setDepth(1002);
        this.withdrawAllText.setOrigin(0.5, 0.5);
        this.withdrawAllText.visible = false;

        // 背包面板银行余额显示
        this.playerBankBalanceBg = this.scene.add.graphics();
        this.playerBankBalanceBg.setDepth(1000);
        this.playerBankBalanceBg.visible = false;

        this.playerBankBalanceText = this.createText(0, 0, '', {
            fontSize: FontConfig.small.size, color: '#ffcc44',
            fontFamily: FontConfig.small.family,
        });
        this.playerBankBalanceText.setDepth(1001);
        this.playerBankBalanceText.setOrigin(0.5, 0.5);
        this.playerBankBalanceText.visible = false;
    }

    update(entities: Entity[], _delta: number): void {
        const uistate = this.getUIState(entities);

        // 外部打开（BankSystem E键交互）
        if (uistate?.bankOpen && !this.isOpen) {
            const player = entities.find(e => e.hasComponent('inventory') && e.hasComponent('player'));
            if (player) {
                this.isOpen = true;
                this.targetEntity = player;
            }
        }

        // 外部关闭请求
        if (uistate && !uistate.bankOpen && this.isOpen) {
            this.isOpen = false;
            this.targetEntity = null;
        }

        // 读取全局 UI 缩放
        const settingsEntity = entities.find(e => e.hasComponent('settings'));
        const settings = settingsEntity?.getComponent<SettingsComponent>('settings');
        this.uiScale = settings?.uiScale ?? 1.0;

        if (!this.isOpen || !this.targetEntity) {
            this.hideAll();
            return;
        }

        this.renderGrid();
        this.checkHoverAndSetTooltip(uistate);
    }

    private getUIState(entities: Entity[]): UIStateComponent | undefined {
        const entity = entities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<UIStateComponent>('uistate');
    }

    private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
        const cam = this.scene.cameras.main;
        const worldPoint = cam.getWorldPoint(screenX, screenY);
        return { x: worldPoint.x, y: worldPoint.y };
    }

    private getPanelLayout(): {
        leftGridX: number;
        rightPanelX: number;
        gridY: number;
        panelW: number;
        panelH: number;
    } {
        const cam = this.scene.cameras.main;
        const scale = this.uiScale;

        const cellSize = this.BASE_CELL_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const padding = this.BASE_PADDING * scale;

        const panelW = this.COLS * cellSize + (this.COLS - 1) * gap + padding * 2;
        const panelH = this.ROWS * cellSize + (this.ROWS - 1) * gap + padding * 2;

        const cx = cam.midPoint.x;
        const cy = cam.midPoint.y;

        const gapBetween = 24 * scale;
        const totalW = panelW * 2 + gapBetween;
        const leftGridX = cx - totalW / 2;
        const rightPanelX = leftGridX + panelW + gapBetween;
        const gridY = cy - panelH / 2;

        return { leftGridX, rightPanelX, gridY, panelW, panelH };
    }

    private renderGrid(): void {
        if (!this.targetEntity) return;

        const playerInventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        const bankComp = this.targetEntity.getComponent<BankComponent>('bank');

        const scale = this.uiScale;
        const { leftGridX, rightPanelX, gridY, panelW, panelH } = this.getPanelLayout();
        const padding = this.BASE_PADDING * scale;

        // 绘制背景面板
        this.panel.clear();

        // 玩家面板背景（左侧）
        this.panel.fillStyle(0x1a1a2e, 0.95);
        this.panel.fillRoundedRect(leftGridX - padding, gridY - padding, panelW, panelH, 8 * scale);
        this.panel.lineStyle(2 * scale, 0x444466, 1);
        this.panel.strokeRoundedRect(leftGridX - padding, gridY - padding, panelW, panelH, 8 * scale);

        // 银行余额显示（背包面板下方，独立小块）
        const bankGold = bankComp?.gold ?? 0;
        const balanceText = `银行: ${bankGold} 金币`;
        const bgW = 88 * scale;
        const bgH = 18 * scale;
        const bgX = leftGridX - padding + 6 * scale;
        const bgY = gridY - padding + panelH + 6 * scale;
        this.playerBankBalanceBg.clear();
        this.playerBankBalanceBg.fillStyle(0x2a2a3e, 0.9);
        this.playerBankBalanceBg.fillRoundedRect(bgX, bgY, bgW, bgH, 4 * scale);
        this.playerBankBalanceBg.lineStyle(Math.max(1, scale), 0xaa8844, 1);
        this.playerBankBalanceBg.strokeRoundedRect(bgX, bgY, bgW, bgH, 4 * scale);
        this.playerBankBalanceBg.visible = true;
        this.playerBankBalanceText.setPosition(bgX + bgW / 2, bgY + bgH / 2);
        this.playerBankBalanceText.setScale(scale);
        this.playerBankBalanceText.setText(balanceText);
        this.playerBankBalanceText.visible = true;

        // 银行面板背景（右侧）
        this.panel.fillStyle(0x1a1a2e, 0.95);
        this.panel.fillRoundedRect(rightPanelX - padding, gridY - padding, panelW, panelH, 8 * scale);
        this.panel.lineStyle(2 * scale, 0xaa8844, 1);
        this.panel.strokeRoundedRect(rightPanelX - padding, gridY - padding, panelW, panelH, 8 * scale);

        // 绘制格子和物品
        this.itemGraphics.clear();
        let textIdx = 0;
        let spriteIdx = 0;

        // 玩家格子（左侧）
        for (let i = 0; i < playerInventory.capacity; i++) {
            ({ textIdx, spriteIdx } = this.renderSlot(leftGridX, gridY, i, playerInventory.items[i], scale, textIdx, spriteIdx));
        }

        for (let i = textIdx; i < this.quantityTexts.length; i++) {
            this.quantityTexts[i].visible = false;
        }
        for (let i = spriteIdx; i < this.itemSprites.length; i++) {
            this.itemSprites[i].visible = false;
        }

        // 银行面板内容（右侧）
        const cellSize = this.BASE_CELL_SIZE * scale;
        const rightCenterX = rightPanelX + panelW / 2 - padding;

        // 标题
        this.bankTitleText.setPosition(rightCenterX, gridY + padding);
        this.bankTitleText.setScale(scale);
        this.bankTitleText.visible = true;

        // 余额
        const balance = bankComp?.gold ?? 0;
        this.bankBalanceText.setPosition(rightCenterX, gridY + padding + 24 * scale);
        this.bankBalanceText.setScale(scale);
        this.bankBalanceText.setText(`${balance} 金币`);
        this.bankBalanceText.visible = true;

        // 操作按钮区域
        const btnW = panelW - padding * 2;
        const btnH = cellSize;
        const btnGap = 8 * scale;
        const btnX = rightPanelX;
        const btnOneY = gridY + padding + 60 * scale;
        const btnAllY = btnOneY + btnH + btnGap;

        // 取出 1 个按钮背景
        this.withdrawOneBg.clear();
        this.withdrawOneBg.fillStyle(0x2a3a2e, 1);
        this.withdrawOneBg.fillRoundedRect(btnX, btnOneY, btnW, btnH, 4 * scale);
        this.withdrawOneBg.lineStyle(Math.max(1, scale), 0x44aa66, 1);
        this.withdrawOneBg.strokeRoundedRect(btnX, btnOneY, btnW, btnH, 4 * scale);
        this.withdrawOneBg.visible = true;

        this.withdrawOneText.setPosition(btnX + btnW / 2, btnOneY + btnH / 2);
        this.withdrawOneText.setScale(scale);
        this.withdrawOneText.setColor(balance > 0 ? '#ffffff' : '#666666');
        this.withdrawOneText.visible = true;

        // 取出全部按钮背景
        this.withdrawAllBg.clear();
        this.withdrawAllBg.fillStyle(0x2a3a2e, 1);
        this.withdrawAllBg.fillRoundedRect(btnX, btnAllY, btnW, btnH, 4 * scale);
        this.withdrawAllBg.lineStyle(Math.max(1, scale), 0x44aa66, 1);
        this.withdrawAllBg.strokeRoundedRect(btnX, btnAllY, btnW, btnH, 4 * scale);
        this.withdrawAllBg.visible = true;

        this.withdrawAllText.setPosition(btnX + btnW / 2, btnAllY + btnH / 2);
        this.withdrawAllText.setScale(scale);
        this.withdrawAllText.setColor(balance > 0 ? '#ffffff' : '#666666');
        this.withdrawAllText.visible = true;

        this.panel.visible = true;
        this.itemGraphics.visible = true;
    }

    private renderSlot(
        gridX: number,
        gridY: number,
        index: number,
        item: InventoryItem | null,
        scale: number,
        textIdx: number,
        spriteIdx: number
    ): { textIdx: number; spriteIdx: number } {
        const cellSize = this.BASE_CELL_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const slotX = gridX + (index % this.COLS) * (cellSize + gap);
        const slotY = gridY + Math.floor(index / this.COLS) * (cellSize + gap);

        // 格子背景
        this.itemGraphics.fillStyle(0x2a2a3e, 1);
        this.itemGraphics.fillRect(slotX, slotY, cellSize, cellSize);

        // 格子边框
        this.itemGraphics.lineStyle(Math.max(1, scale), 0x555577, 1);
        this.itemGraphics.strokeRect(slotX, slotY, cellSize, cellSize);

        if (item) {
            // 道具图标
            if (spriteIdx < this.itemSprites.length) {
                const sprite = this.itemSprites[spriteIdx];
                const iconSize = cellSize - 8 * scale;
                sprite.setTexture(this.getItemTextureKey(item.itemId));
                sprite.setDisplaySize(iconSize, iconSize);
                sprite.setPosition(slotX + 4 * scale, slotY + 4 * scale);
                sprite.setAlpha(1);
                sprite.visible = true;
                spriteIdx++;
            }

            if (textIdx < this.quantityTexts.length) {
                const text = this.quantityTexts[textIdx];
                text.setPosition(slotX + cellSize - 3 * scale, slotY + cellSize - 2 * scale);
                text.setScale(scale);
                text.setText(item.quantity > 1 ? String(item.quantity) : '');
                text.visible = true;
                textIdx++;
            }
        }

        return { textIdx, spriteIdx };
    }

    private hideAll(): void {
        this.panel.visible = false;
        this.itemGraphics.visible = false;
        for (const sprite of this.itemSprites) {
            sprite.visible = false;
        }
        for (const text of this.quantityTexts) {
            text.visible = false;
        }
        this.bankTitleText.visible = false;
        this.bankBalanceText.visible = false;
        this.withdrawOneBg.visible = false;
        this.withdrawOneText.visible = false;
        this.withdrawAllBg.visible = false;
        this.withdrawAllText.visible = false;
        this.playerBankBalanceBg.visible = false;
        this.playerBankBalanceText.visible = false;
    }

    // ============================================================
    // 点击交互
    // ============================================================

    private onPointerDown(pointer: Input.Pointer): void {
        if (!this.isOpen || !this.targetEntity) return;

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;
        if (!itemsMap) return;

        // 检测是否点击背包格子
        const slotIndex = this.getSlotAt(pointer.x, pointer.y);
        if (slotIndex !== null) {
            this.handleSlotClick(slotIndex, itemsMap);
            return;
        }

        // 检测是否点击操作按钮
        const btn = this.getButtonAt(pointer.x, pointer.y);
        if (btn === 'withdraw_one') {
            this.withdraw(1, itemsMap);
        } else if (btn === 'withdraw_all') {
            const bankComp = this.targetEntity.getComponent<BankComponent>('bank');
            const amount = bankComp?.gold ?? 0;
            if (amount > 0) {
                this.withdraw(amount, itemsMap);
            }
        }
    }

    private handleSlotClick(slotIndex: number, _itemsMap: Record<string, ItemDefinition>): void {
        if (!this.targetEntity) return;

        const inventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        const bankComp = this.targetEntity.getComponent<BankComponent>('bank');
        const item = inventory.items[slotIndex];

        if (!item || item.itemId !== 'gold_coin') return;

        // 存入银行：将该格子全部金币存入
        const amount = item.quantity;
        inventory.items[slotIndex] = null;
        if (bankComp) {
            bankComp.gold += amount;
        }
        console.log(`[Bank] 存入 ${amount} 金币，银行余额: ${bankComp?.gold ?? 0}`);
    }

    private withdraw(amount: number, itemsMap: Record<string, ItemDefinition>): void {
        if (!this.targetEntity) return;

        const inventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
        const bankComp = this.targetEntity.getComponent<BankComponent>('bank');
        if (!bankComp || bankComp.gold <= 0) return;

        const actualAmount = Math.min(amount, bankComp.gold);
        const success = InventorySystem.addItem(inventory, itemsMap, 'gold_coin', actualAmount);

        if (success) {
            bankComp.gold -= actualAmount;
            console.log(`[Bank] 取出 ${actualAmount} 金币，银行余额: ${bankComp.gold}`);
        } else {
            console.log('[Bank] 背包已满，无法取出金币');
        }
    }

    private getSlotAt(screenX: number, screenY: number): number | null {
        const { x: worldX, y: worldY } = this.screenToWorld(screenX, screenY);
        const scale = this.uiScale;
        const cellSize = this.BASE_CELL_SIZE * scale;
        const gap = this.BASE_GAP * scale;
        const { leftGridX, gridY } = this.getPanelLayout();

        const playerRelX = worldX - leftGridX;
        const playerRelY = worldY - gridY;
        for (let i = 0; i < this.COLS * this.ROWS; i++) {
            const slotX = (i % this.COLS) * (cellSize + gap);
            const slotY = Math.floor(i / this.COLS) * (cellSize + gap);
            if (
                playerRelX >= slotX && playerRelX < slotX + cellSize &&
                playerRelY >= slotY && playerRelY < slotY + cellSize
            ) {
                return i;
            }
        }

        return null;
    }

    private getButtonAt(screenX: number, screenY: number): 'withdraw_one' | 'withdraw_all' | null {
        const { x: worldX, y: worldY } = this.screenToWorld(screenX, screenY);
        const scale = this.uiScale;
        const { rightPanelX, gridY, panelW } = this.getPanelLayout();
        const padding = this.BASE_PADDING * scale;
        const cellSize = this.BASE_CELL_SIZE * scale;
        const btnW = panelW - padding * 2;
        const btnH = cellSize;
        const btnGap = 8 * scale;
        const btnX = rightPanelX;
        const btnOneY = gridY + padding + 60 * scale;
        const btnAllY = btnOneY + btnH + btnGap;

        if (
            worldX >= btnX && worldX < btnX + btnW &&
            worldY >= btnOneY && worldY < btnOneY + btnH
        ) {
            return 'withdraw_one';
        }

        if (
            worldX >= btnX && worldX < btnX + btnW &&
            worldY >= btnAllY && worldY < btnAllY + btnH
        ) {
            return 'withdraw_all';
        }

        return null;
    }

    // ============================================================
    // Tooltip
    // ============================================================

    private checkHoverAndSetTooltip(uistate: UIStateComponent | undefined): void {
        if (!uistate || !this.targetEntity) return;

        const pointer = this.scene.input.activePointer;
        const slotIndex = this.getSlotAt(pointer.x, pointer.y);
        const btn = this.getButtonAt(pointer.x, pointer.y);

        if (slotIndex === null && btn === null) return;

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;
        const { x: worldX, y: worldY } = this.screenToWorld(pointer.x, pointer.y);

        let nameText = '';
        let typeText = '';
        let descText = '';
        let nameColor = '#ffffff';

        if (slotIndex !== null) {
            const inventory = this.targetEntity.getComponent<InventoryComponent>('inventory')!;
            const item = inventory.items[slotIndex];
            if (!item) return;
            const def = itemsMap?.[item.itemId];
            if (!def) return;
            nameText = def.name;
            typeText = this.typeLabel(def.type);
            descText = def.description;
            if (item.itemId === 'gold_coin') {
                descText += '（点击存入银行）';
            }
            nameColor = this.getRarityColor(def.type);
        } else if (btn === 'withdraw_one') {
            nameText = '取出 1 个';
            typeText = '操作';
            descText = '从银行取出 1 个金币到背包';
        } else if (btn === 'withdraw_all') {
            nameText = '取出全部';
            typeText = '操作';
            descText = '从银行取出所有金币到背包';
        }

        uistate.tooltip = {
            x: worldX,
            y: worldY,
            name: nameText,
            nameColor,
            typeText,
            description: descText,
        };
    }

    private typeLabel(type: string): string {
        switch (type) {
            case 'consumable': return '消耗品';
            case 'equipment': return '装备';
            case 'material': return '材料';
            default: return type;
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
}
