import * as ex from 'excalibur';
import { ChestComponent } from '../components/chest-component';
import { InventoryComponent } from '../components/inventory-component';
import { PlayerControlComponent } from '../components/player-control-component';
import { StorageUI } from '../ui/storage-ui';

export class ChestSystem extends ex.System {
    public systemType = ex.SystemType.Update;
    public chestQuery!: ex.Query<typeof ChestComponent | typeof InventoryComponent | typeof ex.TransformComponent>;
    public playerQuery!: ex.Query<typeof PlayerControlComponent | typeof InventoryComponent | typeof ex.TransformComponent>;

    private engine: ex.Engine;
    private storageUI: StorageUI;
    private prompt: ex.ScreenElement;
    private promptLabel: ex.Label;
    private openChest: ex.Entity | null = null;

    constructor(engine: ex.Engine) {
        super();
        this.engine = engine;
        this.storageUI = new StorageUI();
        this.prompt = new ex.ScreenElement({
            x: 400,
            y: 560,
            anchor: ex.Vector.Half,
            z: 1190
        });
        this.promptLabel = new ex.Label({
            text: '',
            font: new ex.Font({ family: 'Arial', size: 18, color: ex.Color.White, textAlign: ex.TextAlign.Center }),
            pos: ex.vec(0, 0),
            z: 1191
        });
        this.prompt.addChild(this.promptLabel);
        this.prompt.graphics.opacity = 0;
        this.engine.add(this.storageUI);
        this.engine.add(this.prompt);
    }

    initialize(world: ex.World): void {
        this.chestQuery = world.query([ChestComponent, InventoryComponent, ex.TransformComponent]);
        this.playerQuery = world.query([PlayerControlComponent, InventoryComponent, ex.TransformComponent]);
    }

    update(): void {
        const player = this.playerQuery.entities[0];
        if (!player) {
            this.setPrompt('');
            return;
        }

        const playerInventory = player.get(InventoryComponent);
        if (!playerInventory) {
            this.setPrompt('');
            return;
        }

        if (this.storageUI.isOpen()) {
            this.storageUI.refresh();

            if (this.engine.input.keyboard.wasPressed(ex.Keys.E) || this.engine.input.keyboard.wasPressed(ex.Keys.Esc)) {
                this.closeStorage();
                return;
            }

            if (this.openChest && !this.canInteract(player, this.openChest)) {
                this.closeStorage();
            }
            return;
        }

        const nearestChest = this.findNearestChest(player);
        if (nearestChest) {
            const chest = nearestChest.get(ChestComponent);
            this.setPrompt(`按 E 打开${chest?.title || '箱子'}`);
            if (this.engine.input.keyboard.wasPressed(ex.Keys.E)) {
                const chestInventory = nearestChest.get(InventoryComponent);
                if (chestInventory && chest) {
                    this.openChest = nearestChest;
                    this.storageUI.show(player, playerInventory, chestInventory, chest.title);
                    this.setPrompt('');
                }
            }
            return;
        }

        this.setPrompt('');
    }

    private findNearestChest(player: ex.Entity): ex.Entity | null {
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
        return playerPos.distance(chestPos) <= chestComponent.interactDistance;
    }

    private closeStorage() {
        this.openChest = null;
        this.storageUI.hide();
        this.setPrompt('');
    }

    private setPrompt(text: string) {
        this.promptLabel.text = text;
        this.prompt.graphics.opacity = text ? 1 : 0;
    }
}