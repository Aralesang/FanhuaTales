import * as ex from "excalibur";
import { StateMachineComponent } from "../components/state-machine-component";
import { AnimationComponent } from "../components/animation-component";
import { DirectionComponent } from "../components/direction-component";
import { PlayerControlComponent } from "../components/player-control-component";
import { HealthComponent } from "../components/health-component";
import { PlayerComponent } from "../components/player-component";
import { SkillComponent } from "../components/skill-component";
import { SwordSkill } from "../skills/sword-skill";
import { InventoryComponent } from "../components/inventory-component";
import { ItemUseRequestComponent } from "../components/item-use-request-component";
import { HealthBar } from "../ui/health-bar-ui";
import { HotbarComponent } from "../components/hotbar-component";
import { SkillbarComponent } from "../components/skillbar-component";
import { EquipmentComponent } from "../components/equipment-component";

export class Player extends ex.Actor {
    private isControl: boolean;
    constructor(pos: ex.Vector, isControl: boolean) {
        super({
            pos: pos,
            width: 10,
            height: 8,
            anchor: new ex.Vector(0.5, 0.55),
            z: 4
        });
        this.isControl = isControl;
    }

    onInitialize(engine: ex.Engine): void {
        console.log("玩家实体组装");
        this.addComponent(new PlayerComponent());
        this.addComponent(new DirectionComponent(ex.Vector.Down));
        this.addComponent(new StateMachineComponent());
        this.addComponent(new AnimationComponent("human", this));
        const healthComp = new HealthComponent(999);
        this.addComponent(healthComp);
        this.addChild(new HealthBar(healthComp));
        this.body.collisionType = ex.CollisionType.Active;
        this.addTag("player");
        if (this.isControl) {
            this.addComponent(new PlayerControlComponent(50));
        }
        const skillComponent = new SkillComponent();
        this.addComponent(skillComponent);
        skillComponent.addSkill(new SwordSkill());
        this.addComponent(new InventoryComponent());
        this.addComponent(new HotbarComponent());
        this.addComponent(new SkillbarComponent());
        this.addComponent(new EquipmentComponent());
        this.addComponent(new ItemUseRequestComponent());
    }
}
