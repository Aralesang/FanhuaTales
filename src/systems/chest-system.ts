import * as ex from 'excalibur';
import { ChestComponent } from '../components/chest-component';
import { InventoryComponent } from '../components/inventory-component';
import { PlayerControlComponent } from '../components/player-control-component';
import { StorageUI } from '../ui/storage-ui';

// 箱子系统负责管理玩家与场景中箱子的交互流程：
// 1. 轮询玩家与所有箱子的距离，决定是否显示交互提示。
// 2. 在玩家按下 E 时打开双栏仓库界面，让玩家背包与箱子库存互相转移物品。
// 3. 在界面打开期间持续刷新 UI，并在玩家离开交互范围或主动关闭时收起界面。
export class ChestSystem extends ex.System {
    public systemType = ex.SystemType.Update;
    // 所有可交互箱子的查询结果。箱子必须同时具备箱子数据、库存数据和位置信息。
    public chestQuery!: ex.Query<typeof ChestComponent | typeof InventoryComponent | typeof ex.TransformComponent>;
    // 玩家查询结果。当前系统只关心可控制玩家、玩家库存以及玩家位置。
    public playerQuery!: ex.Query<typeof PlayerControlComponent | typeof InventoryComponent | typeof ex.TransformComponent>;

    // 引擎引用用于读取输入状态，并挂载 UI 实体。
    private engine: ex.Engine;
    // 双栏仓库 UI，负责展示玩家背包与箱子库存。
    private storageUI: StorageUI;
    // 底部提示容器，用于显示“按 E 打开箱子”等交互文案。
    private prompt: ex.ScreenElement;
    // 提示容器中的文本标签。
    private promptLabel: ex.Label;
    // 当前已打开的箱子实体。用于在界面打开后校验玩家是否仍在交互范围内。
    private openChest: ex.Entity | null = null;

    constructor(engine: ex.Engine) {
        super();
        this.engine = engine;
        this.storageUI = new StorageUI();
        // 提示 UI 固定在屏幕底部中央，不跟随地图滚动。
        this.prompt = new ex.ScreenElement({
            x: 400,
            y: 560,
            anchor: ex.Vector.Half,
            z: 1190
        });
        // 提示文本使用独立 Label，便于后续仅更新文字内容。
        this.promptLabel = new ex.Label({
            text: '',
            font: new ex.Font({ family: 'Arial', size: 18, color: ex.Color.White, textAlign: ex.TextAlign.Center }),
            pos: ex.vec(0, 0),
            z: 1191
        });
        this.prompt.addChild(this.promptLabel);
        // 初始时隐藏提示，只有检测到可交互箱子时才显示。
        this.prompt.graphics.opacity = 0;
        this.engine.add(this.storageUI);
        this.engine.add(this.prompt);
    }

    initialize(world: ex.World): void {
        // 系统启动时缓存查询对象，后续 update 中直接读取实体列表即可。
        this.chestQuery = world.query([ChestComponent, InventoryComponent, ex.TransformComponent]);
        this.playerQuery = world.query([PlayerControlComponent, InventoryComponent, ex.TransformComponent]);
    }

    update(): void {
        // 当前项目默认只存在一个主控玩家，因此直接取第一个匹配实体。
        const player = this.playerQuery.entities[0];
        if (!player) {
            // 没有玩家时不应显示任何交互提示。
            this.setPrompt('');
            return;
        }

        const playerInventory = player.get(InventoryComponent);
        if (!playerInventory) {
            // 理论上玩家应始终带有库存组件；若缺失则直接终止本帧交互逻辑。
            this.setPrompt('');
            return;
        }

        if (this.storageUI.isOpen()) {
            // UI 打开期间仍然需要刷新数据与选中态，确保双方库存变化实时反映到界面。
            this.storageUI.refresh();

            // E 与 Esc 都可作为关闭仓库的快捷键。
            if (this.engine.input.keyboard.wasPressed(ex.Keys.E) || this.engine.input.keyboard.wasPressed(ex.Keys.Esc)) {
                this.closeStorage();
                return;
            }

            // 如果玩家在打开箱子后离开了交互范围，则强制关闭，避免远距离操作箱子。
            if (this.openChest && !this.canInteract(player, this.openChest)) {
                this.closeStorage();
            }
            return;
        }

        // UI 未打开时，持续寻找当前可交互的最近箱子并显示提示。
        const nearestChest = this.findNearestChest(player);
        if (nearestChest) {
            const chest = nearestChest.get(ChestComponent);
            this.setPrompt(`按 E 打开${chest?.title || '箱子'}`);
            if (this.engine.input.keyboard.wasPressed(ex.Keys.E)) {
                const chestInventory = nearestChest.get(InventoryComponent);
                if (chestInventory && chest) {
                    // 记录当前打开的箱子，便于后续校验距离并在关闭时清理状态。
                    this.openChest = nearestChest;
                    this.storageUI.show(player, playerInventory, chestInventory, chest.title);
                    this.setPrompt('');
                }
            }
            return;
        }

        // 周围没有可交互箱子时，确保提示隐藏。
        this.setPrompt('');
    }

    private findNearestChest(player: ex.Entity): ex.Entity | null {
        // 当前实现按查询结果顺序返回首个可交互箱子。
        // 若未来同屏存在多个近距离箱子，可在这里扩展为真正的最近距离排序逻辑。
        for (const chest of this.chestQuery.entities) {
            if (this.canInteract(player, chest)) {
                return chest;
            }
        }
        return null;
    }

    private canInteract(player: ex.Entity, chest: ex.Entity): boolean {
        const chestComponent = chest.get(ChestComponent);
        const playerPos = (player as ex.Actor).pos;
        const chestPos = (chest as ex.Actor).pos;
        if (!chestComponent || !playerPos || !chestPos) {
            return false;
        }
        // 交互半径由箱子组件配置，便于不同箱子使用不同的开启距离。
        return playerPos.distance(chestPos) <= chestComponent.interactDistance;
    }

    private closeStorage() {
        // 关闭时同时清除已打开箱子的引用，避免旧状态影响下一次交互。
        this.openChest = null;
        this.storageUI.hide();
        this.setPrompt('');
    }

    private setPrompt(text: string) {
        // 通过文本是否为空来控制提示显隐，避免额外维护独立的显示状态字段。
        this.promptLabel.text = text;
        this.prompt.graphics.opacity = text ? 1 : 0;
    }
}