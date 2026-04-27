import * as ex from 'excalibur';
import { NPCComponent } from '../components/npc-component';
import { InventoryComponent } from '../components/inventory-component';
import { PlayerControlComponent } from '../components/player-control-component';
import { NPCInteractUI } from '../ui/npc-interact-ui';
import { ShopUI } from '../ui/shop-ui';

export class NPCSystem extends ex.System {
    public systemType = ex.SystemType.Update;
    public npcQuery!: ex.Query<typeof NPCComponent | typeof InventoryComponent | typeof ex.TransformComponent>;
    public playerQuery!: ex.Query<typeof PlayerControlComponent | typeof InventoryComponent | typeof ex.TransformComponent>;

    private engine: ex.Engine;
    private interactUI: NPCInteractUI;
    private shopUI: ShopUI;
    private prompt: ex.ScreenElement;
    private promptLabel: ex.Label;
    private openNPC: ex.Entity | null = null;

    constructor(engine: ex.Engine) {
        super();
        this.engine = engine;
        this.interactUI = new NPCInteractUI(engine);
        this.shopUI = new ShopUI(engine);
        this.prompt = new ex.ScreenElement({
            x: 400,
            y: 560,
            anchor: ex.Vector.Half,
            z: 1190
        });
        this.promptLabel = new ex.Label({
            text: '',
            font: new ex.Font({ family: 'Arial', size: 18, color: ex.Color.White, textAlign: ex.TextAlign.Center }),
            pos: ex.vec(0, -200),
            z: 1191
        });
        this.prompt.addChild(this.promptLabel);
        this.prompt.graphics.opacity = 0;
        this.engine.add(this.interactUI);
        this.engine.add(this.shopUI);
        this.engine.add(this.prompt);
    }

    initialize(world: ex.World): void {
        this.npcQuery = world.query([NPCComponent, InventoryComponent, ex.TransformComponent]);
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

        if (this.shopUI.isOpen()) {
            this.shopUI.refresh();
            if (this.engine.input.keyboard.wasPressed(ex.Keys.E) || this.engine.input.keyboard.wasPressed(ex.Keys.Esc)) {
                this.shopUI.hide();
                return;
            }
            if (this.openNPC && !this.canInteract(player, this.openNPC)) {
                this.shopUI.hide();
                this.openNPC = null;
            }
            return;
        }

        if (this.interactUI.isOpen()) {
            if (this.engine.input.keyboard.wasPressed(ex.Keys.E) || this.engine.input.keyboard.wasPressed(ex.Keys.Esc)) {
                this.interactUI.hide();
                this.openNPC = null;
                return;
            }
            if (this.openNPC && !this.canInteract(player, this.openNPC)) {
                this.interactUI.hide();
                this.openNPC = null;
            }
            return;
        }

        const nearestNPC = this.findNearestNPC(player);
        if (nearestNPC) {
            const npcComponent = nearestNPC.get(NPCComponent);
            this.setPrompt(`按 E 与${npcComponent?.name || 'NPC'}交互`);
            if (this.engine.input.keyboard.wasPressed(ex.Keys.E)) {
                const npcInventory = nearestNPC.get(InventoryComponent);
                if (npcInventory && npcComponent) {
                    this.openNPC = nearestNPC;
                    this.interactUI.show(npcComponent.name, (choice) => {
                        this.handleChoice(choice, player, playerInventory, nearestNPC, npcInventory, npcComponent.name);
                    });
                    this.setPrompt('');
                }
            }
            return;
        }

        this.setPrompt('');
    }

    private handleChoice(
        choice: 'talk' | 'shop',
        player: ex.Entity,
        playerInventory: InventoryComponent,
        npc: ex.Entity,
        npcInventory: InventoryComponent,
        npcName: string
    ) {
        this.interactUI.hide();
        if (choice === 'talk') {
            // TODO: 以后有了对话系统后再来添加对话逻辑
            console.log(`与 ${npcName} 对话（待实现）`);
            this.openNPC = null;
        } else if (choice === 'shop') {
            this.shopUI.show(player, playerInventory, npcInventory, npcName);
        }
    }

    private findNearestNPC(player: ex.Entity): ex.Entity | null {
        for (const npc of this.npcQuery.entities) {
            if (this.canInteract(player, npc)) {
                return npc;
            }
        }
        return null;
    }

    private canInteract(player: ex.Entity, npc: ex.Entity): boolean {
        const npcComponent = npc.get(NPCComponent);
        const playerPos = (player as ex.Actor).pos;
        const npcPos = (npc as ex.Actor).pos;
        if (!npcComponent || !playerPos || !npcPos) {
            return false;
        }
        return playerPos.distance(npcPos) <= npcComponent.interactDistance;
    }

    private setPrompt(text: string) {
        this.promptLabel.text = text;
        this.prompt.graphics.opacity = text ? 1 : 0;
    }
}
