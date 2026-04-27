import * as ex from 'excalibur';
import { NPCComponent } from '../components/npc-component';
import { InventoryComponent } from '../components/inventory-component';
import { DirectionComponent } from '../components/direction-component';
import { AnimationComponent } from '../components/animation-component';
import { HealthComponent } from '../components/health-component';

export type NPCOptions = {
    name?: string;
    animationType?: string;
    interactDistance?: number;
    tint?: ex.Color;
};

export class NPC extends ex.Actor {
    private readonly options: NPCOptions;

    constructor(pos: ex.Vector, options?: NPCOptions) {
        super({
            pos,
            width: 10,
            height: 8,
            anchor: new ex.Vector(0.5, 0.55),
            z: 4,
            name: options?.name ?? '商人'
        });
        this.options = options ?? {};
    }

    override onInitialize(_engine: ex.Engine): void {
        this.addComponent(new NPCComponent(this.options.name ?? '商人', this.options.interactDistance));
        this.addComponent(new InventoryComponent());
        this.addComponent(new DirectionComponent(ex.Vector.Down));
        this.addComponent(new AnimationComponent(this.options.animationType ?? 'human', this, this.options.tint));
        this.addComponent(new HealthComponent(999));

        this.body.collisionType = ex.CollisionType.Active;
        this.addTag('npc');
    }
}
