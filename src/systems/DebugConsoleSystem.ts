import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import {
    UIStateComponent,
    InventoryComponent,
    HealthComponent,
    NeedsComponent,
    BuffComponent,
    ItemDefinition
} from '../ecs/Component';
import { InventorySystem } from './InventorySystem';

/**
 * 调试控制台系统
 *
 * 按 ~ 键打开/关闭一个类似浏览器控制台的 DOM overlay，功能包括：
 * - 显示游戏日志（拦截 console.log/warn/error）
 * - 命令输入框，支持以下命令：
 *   get_item_all                    将所有物品添加到背包
 *   get_item <id> [数量]            获取指定物品
 *   add_buff <buffid> <持续时间ms>  添加指定 buff
 *   set_hp <数值>                   设置当前生命值
 *   set_hunger <数值>               设置饥饿值
 *   set_thirst <数值>               设置口渴值
 */
export class DebugConsoleSystem extends System {
    private container!: HTMLDivElement;
    private logArea!: HTMLDivElement;
    private inputEl!: HTMLInputElement;
    private isOpen = false;
    private originalLog!: typeof console.log;
    private originalWarn!: typeof console.warn;
    private originalError!: typeof console.error;
    private keyHandler!: (e: KeyboardEvent) => void;
    private currentEntities: Entity[] = [];

    constructor(scene: import('phaser').Scene) {
        super(scene);
        this.createDOM();
        this.hookConsole();
        this.bindKeys();
    }

    private createDOM(): void {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 40%;
            background: rgba(0, 0, 0, 0.85);
            display: none;
            flex-direction: column;
            z-index: 10000;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            color: #ffffff;
        `;

        const logArea = document.createElement('div');
        logArea.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            white-space: pre-wrap;
            word-break: break-word;
        `;
        container.appendChild(logArea);

        const inputRow = document.createElement('div');
        inputRow.style.cssText = `
            display: flex;
            align-items: center;
            padding: 8px 10px;
            border-top: 1px solid #444444;
        `;

        const prompt = document.createElement('span');
        prompt.textContent = '>';
        prompt.style.cssText = 'color: #44ff44; margin-right: 8px; font-weight: bold;';
        inputRow.appendChild(prompt);

        const inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.style.cssText = `
            flex: 1;
            background: transparent;
            border: none;
            color: #ffffff;
            font-family: inherit;
            font-size: inherit;
            outline: none;
        `;
        inputEl.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
                const cmd = inputEl.value.trim();
                if (cmd) {
                    this.appendLog('input', [cmd]);
                    this.executeCommand(cmd);
                }
                inputEl.value = '';
            }
            if (e.key === 'Escape') {
                this.close();
            }
        });
        inputRow.appendChild(inputEl);
        container.appendChild(inputRow);

        document.body.appendChild(container);
        this.container = container;
        this.logArea = logArea;
        this.inputEl = inputEl;
    }

    private hookConsole(): void {
        this.originalLog = console.log;
        this.originalWarn = console.warn;
        this.originalError = console.error;

        console.log = (...args: unknown[]) => {
            this.originalLog(...args);
            this.appendLog('log', args);
        };
        console.warn = (...args: unknown[]) => {
            this.originalWarn(...args);
            this.appendLog('warn', args);
        };
        console.error = (...args: unknown[]) => {
            this.originalError(...args);
            this.appendLog('error', args);
        };
    }

    private unhookConsole(): void {
        console.log = this.originalLog;
        console.warn = this.originalWarn;
        console.error = this.originalError;
    }

    private bindKeys(): void {
        this.keyHandler = (e: KeyboardEvent) => {
            // 仅当输入框没有焦点时，~ 键切换面板
            if (e.key === '`' || e.key === '~' || e.code === 'Backquote') {
                if (document.activeElement !== this.inputEl) {
                    e.preventDefault();
                    this.toggle();
                }
            }
            // Escape 关闭面板
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        };
        document.addEventListener('keydown', this.keyHandler);
    }

    private toggle(): void {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    private open(): void {
        this.isOpen = true;
        this.container.style.display = 'flex';
        this.inputEl.focus();
    }

    private close(): void {
        this.isOpen = false;
        this.container.style.display = 'none';
        this.inputEl.blur();
    }

    private appendLog(level: 'log' | 'warn' | 'error' | 'input', args: unknown[]): void {
        const line = document.createElement('div');
        line.style.marginBottom = '2px';

        let color = '#ffffff';
        if (level === 'warn') color = '#ffcc00';
        if (level === 'error') color = '#ff4444';
        if (level === 'input') color = '#aaaaaa';

        line.style.color = color;

        const text = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');

        if (level === 'input') {
            line.textContent = `> ${text}`;
        } else {
            line.textContent = text;
        }

        this.logArea.appendChild(line);
        this.logArea.scrollTop = this.logArea.scrollHeight;
    }

    private executeCommand(cmd: string): void {
        const parts = cmd.split(/\s+/);
        const command = parts[0].toLowerCase();

        switch (command) {
            case 'get_item_all':
                this.cmdGetAllItems();
                break;
            case 'get_item':
                this.cmdGetItem(parts);
                break;
            case 'add_buff':
                this.cmdAddBuff(parts);
                break;
            case 'set_hp':
                this.cmdSetHp(parts);
                break;
            case 'set_hunger':
                this.cmdSetHunger(parts);
                break;
            case 'set_thirst':
                this.cmdSetThirst(parts);
                break;
            case 'clear':
                this.logArea.innerHTML = '';
                break;
            case 'help':
                this.printHelp();
                break;
            default:
                console.warn(`[DebugConsole] 未知命令: ${command}，输入 help 查看可用命令`);
        }
    }

    private cmdGetAllItems(): void {
        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;
        if (!itemsMap) {
            console.warn('[DebugConsole] 物品配置未加载');
            return;
        }

        const player = this.getPlayer();
        if (!player) {
            console.warn('[DebugConsole] 未找到玩家');
            return;
        }

        const inventory = player.getComponent<InventoryComponent>('inventory')!;
        for (const itemId of Object.keys(itemsMap)) {
            const def = itemsMap[itemId];
            const quantity = def.stackable ? def.maxStack : 1;
            InventorySystem.addItem(inventory, itemsMap, itemId, quantity);
        }
        console.log('[DebugConsole] 已添加所有物品到背包');
    }

    private cmdGetItem(parts: string[]): void {
        if (parts.length < 2) {
            console.warn('[DebugConsole] 用法: get_item <物品ID> [数量]');
            return;
        }

        const itemId = parts[1];
        const quantity = parts.length >= 3 ? parseInt(parts[2], 10) : 1;
        if (isNaN(quantity) || quantity <= 0) {
            console.warn('[DebugConsole] 数量必须是正整数');
            return;
        }

        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition> | undefined;
        if (!itemsMap) {
            console.warn('[DebugConsole] 物品配置未加载');
            return;
        }

        const player = this.getPlayer();
        if (!player) {
            console.warn('[DebugConsole] 未找到玩家');
            return;
        }

        const inventory = player.getComponent<InventoryComponent>('inventory')!;
        const success = InventorySystem.addItem(inventory, itemsMap, itemId, quantity);
        if (success) {
            console.log(`[DebugConsole] 已添加 ${itemId} x${quantity}`);
        } else {
            console.warn(`[DebugConsole] 添加 ${itemId} x${quantity} 失败（可能库存已满或物品不存在）`);
        }
    }

    private cmdAddBuff(parts: string[]): void {
        if (parts.length < 3) {
            console.warn('[DebugConsole] 用法: add_buff <buffID> <持续时间(ms)>');
            return;
        }

        const buffId = parts[1];
        const duration = parseInt(parts[2], 10);
        if (isNaN(duration) || duration <= 0) {
            console.warn('[DebugConsole] 持续时间必须是正整数（毫秒）');
            return;
        }

        const buffsMap = this.scene.cache.json.get('buffsMap') as Record<string, unknown> | undefined;
        if (!buffsMap || !buffsMap[buffId]) {
            console.warn(`[DebugConsole] 未找到 buff: ${buffId}`);
            return;
        }

        const player = this.getPlayer();
        if (!player) {
            console.warn('[DebugConsole] 未找到玩家');
            return;
        }

        if (!player.hasComponent('buff')) {
            console.warn('[DebugConsole] 玩家没有 buff 组件');
            return;
        }

        const buffComp = player.getComponent<BuffComponent>('buff')!;
        buffComp.pendingBuffs.push({ buffId, duration });
        console.log(`[DebugConsole] 已添加 buff: ${buffId}，持续时间 ${duration}ms`);
    }

    private cmdSetHp(parts: string[]): void {
        if (parts.length < 2) {
            console.warn('[DebugConsole] 用法: set_hp <数值>');
            return;
        }

        const val = parseInt(parts[1], 10);
        if (isNaN(val)) {
            console.warn('[DebugConsole] 数值必须是整数');
            return;
        }

        const player = this.getPlayer();
        if (!player) {
            console.warn('[DebugConsole] 未找到玩家');
            return;
        }

        const health = player.getComponent<HealthComponent>('health')!;
        health.hp = Math.max(0, Math.min(val, health.maxHp));
        console.log(`[DebugConsole] 生命值已设置为 ${health.hp}`);
    }

    private cmdSetHunger(parts: string[]): void {
        if (parts.length < 2) {
            console.warn('[DebugConsole] 用法: set_hunger <数值>');
            return;
        }

        const val = parseInt(parts[1], 10);
        if (isNaN(val)) {
            console.warn('[DebugConsole] 数值必须是整数');
            return;
        }

        const player = this.getPlayer();
        if (!player) {
            console.warn('[DebugConsole] 未找到玩家');
            return;
        }

        const needs = player.getComponent<NeedsComponent>('needs')!;
        needs.hunger = Math.max(0, Math.min(val, needs.maxHunger));
        console.log(`[DebugConsole] 饥饿值已设置为 ${needs.hunger}`);
    }

    private cmdSetThirst(parts: string[]): void {
        if (parts.length < 2) {
            console.warn('[DebugConsole] 用法: set_thirst <数值>');
            return;
        }

        const val = parseInt(parts[1], 10);
        if (isNaN(val)) {
            console.warn('[DebugConsole] 数值必须是整数');
            return;
        }

        const player = this.getPlayer();
        if (!player) {
            console.warn('[DebugConsole] 未找到玩家');
            return;
        }

        const needs = player.getComponent<NeedsComponent>('needs')!;
        needs.thirst = Math.max(0, Math.min(val, needs.maxThirst));
        console.log(`[DebugConsole] 口渴值已设置为 ${needs.thirst}`);
    }

    private printHelp(): void {
        const helpText = [
            '可用命令:',
            '  get_item_all                              将所有物品添加到背包（可堆叠给上限，不可堆叠给1）',
            '  get_item <物品ID> [数量]                   添加指定物品',
            '  add_buff <buffID> <持续时间(ms)>           添加指定 buff（如 add_buff regen 10000）',
            '  set_hp <数值>                             设置当前生命值',
            '  set_hunger <数值>                         设置饥饿值',
            '  set_thirst <数值>                         设置口渴值',
            '  clear                                     清空日志',
            '  help                                      显示此帮助',
        ];
        for (const line of helpText) {
            this.appendLog('log', [line]);
        }
    }

    private getPlayer(): Entity | undefined {
        return this.currentEntities.find(e => e.hasComponent('player'));
    }

    update(entities: Entity[], _delta: number): void {
        this.currentEntities = entities;
        const uistate = this.getUIState(entities);
        if (uistate) {
            uistate.debugConsoleOpen = this.isOpen;
        }
    }

    private getUIState(entities: Entity[]): UIStateComponent | undefined {
        const entity = entities.find(e => e.hasComponent('uistate'));
        return entity?.getComponent<UIStateComponent>('uistate');
    }

    destroy(): void {
        this.unhookConsole();
        document.removeEventListener('keydown', this.keyHandler);
        this.container.remove();
    }
}
