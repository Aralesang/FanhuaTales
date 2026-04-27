import * as ex from "excalibur";
import { PlayerControlComponent } from "../components/player-control-component";
import { StateMachineComponent } from "../components/state-machine-component";
import { DirectionComponent } from "../components/direction-component";
import { SkillComponent } from "../components/skill-component";
import { InventoryComponent } from "../components/inventory-component";
import { EquipmentComponent } from "../components/equipment-component";
import { CharacterInventoryUI } from "../ui/character-inventory-ui";
import { InventoryLabUI } from "../ui/Inventory-lab-ui";

export class PlayerControlSystem extends ex.System {
    private engine: ex.Engine;
    public systemType = ex.SystemType.Update;
    public query!: ex.Query<
        typeof ex.TransformComponent |
        typeof PlayerControlComponent |
        typeof StateMachineComponent |
        typeof DirectionComponent |
        typeof SkillComponent
    >;

    private _horizontalKeys: ex.Keys[] = [];
    private _verticalKeys: ex.Keys[] = [];
    private _otherKeys: ex.Keys[] = [];
    private characterInventoryUI: CharacterInventoryUI;
    private inventoryLabUI: InventoryLabUI;
    private world!: ex.World;
    private currentInventory: InventoryComponent | null = null;
    private currentEquipment: EquipmentComponent | null = null;

    constructor(engine: ex.Engine) {
        super();
        this.engine = engine;
        this.characterInventoryUI = new CharacterInventoryUI(engine);
        this.inventoryLabUI = new InventoryLabUI(engine);
        this.engine.add(this.characterInventoryUI);
        this.engine.add(this.inventoryLabUI);
    }

    initialize(world: ex.World, scene: ex.Scene): void {
        this.world = world;
        console.log("PlayerControlSystem");
        this.query = world.query([
            ex.TransformComponent,
            PlayerControlComponent,
            StateMachineComponent,
            SkillComponent,
            DirectionComponent
        ]);
        this.engine.input.keyboard.on("press", (evt) => {
            const key = evt.key;
            if (key === ex.Keys.Left || key === ex.Keys.Right) {
                this._horizontalKeys = this._horizontalKeys.filter(k => k !== key);
                this._horizontalKeys.push(key);
            } else if (key === ex.Keys.Up || key === ex.Keys.Down) {
                this._verticalKeys = this._verticalKeys.filter(k => k !== key);
                this._verticalKeys.push(key);
            } else {
                this._otherKeys = this._otherKeys.filter(k => k !== key);
                this._otherKeys.push(key);
            }
        });

        this.engine.input.keyboard.on("release", (evt) => {
            const key = evt.key;
            if (key === ex.Keys.Left || key === ex.Keys.Right) {
                this._horizontalKeys = this._horizontalKeys.filter(k => k !== key);
            }
            if (key === ex.Keys.Up || key === ex.Keys.Down) {
                this._verticalKeys = this._verticalKeys.filter(k => k !== key);
            }
            if (key === ex.Keys.I) {
                console.log("打开角色装备+背包界面");
                this.characterInventoryUI.toggle();
            }
            if (key === ex.Keys.B) {
                console.log("打开测试界面");
                this.inventoryLabUI.toggle();
            }
        });
    }

    update(delta: number): void {
        const playerEntities = this.world.query([PlayerControlComponent, InventoryComponent]).entities;
        if (playerEntities.length > 0) {
            const player = playerEntities[0];
            const inventory = player.get(InventoryComponent);
            if (inventory && inventory !== this.currentInventory) {
                this.currentInventory = inventory;
                this.characterInventoryUI.setInventory(inventory);
                this.characterInventoryUI.setOwner(player);
            }
            const equipment = player.get(EquipmentComponent);
            if (equipment && equipment !== this.currentEquipment) {
                this.currentEquipment = equipment;
                this.characterInventoryUI.setEquipment(equipment);
            }
        }

        const kb = this.engine.input.keyboard;
        const horizontalKey = this._horizontalKeys.slice().reverse().find(k => kb.isHeld(k));
        const verticalKey = this._verticalKeys.slice().reverse().find(k => kb.isHeld(k));
        const otherKey = this._otherKeys.shift();
        for (let entity of this.query.entities) {
            const transform = entity.get(ex.TransformComponent);
            const control = entity.get(PlayerControlComponent);
            const stateMachine = entity.get(StateMachineComponent);
            const skillComponent = entity.get(SkillComponent);
            const direction = entity.get(DirectionComponent);
            let velX = 0;
            let velY = 0;

            if (stateMachine.fsm == undefined) {
                continue;
            }
            const currentState = stateMachine.fsm.currentState;

            if (otherKey === ex.Keys.X) {
                console.log("按下攻击");
                if (skillComponent.isSkillReady("Sword")) {
                    const swordSkill = skillComponent.getSkill("Sword");
                    if (swordSkill) {
                        skillComponent.setCurrentSkill(swordSkill);
                        stateMachine.fsm.go("Skill");
                    }
                }
            }

            if (currentState.name === "Idle" || currentState.name == "Walk" || currentState.name == "Run") {
                if (verticalKey === ex.Keys.Up) {
                    velY = -control.speed;
                    direction.direction = ex.Vector.Up;
                } else if (verticalKey === ex.Keys.Down) {
                    velY = control.speed;
                    direction.direction = ex.Vector.Down;
                }

                if (horizontalKey === ex.Keys.Left) {
                    velX = -control.speed;
                    direction.direction = ex.Vector.Left;
                } else if (horizontalKey === ex.Keys.Right) {
                    velX = control.speed;
                    direction.direction = ex.Vector.Right;
                }
            }

            if (currentState.name === "Idle") {
                if (velX != 0 || velY != 0) {
                    stateMachine.fsm.go("Walk");
                }
            }

            if (currentState.name == "Walk" || currentState.name == "Run") {
                const deltaSeconds = delta / 1000;
                transform.pos.x += velX * deltaSeconds;
                transform.pos.y += velY * deltaSeconds;

                if (velX == 0 && velY == 0) {
                    stateMachine.fsm.go("Idle");
                }
            }
        }
    }
}
