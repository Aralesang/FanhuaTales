import * as ex from 'excalibur';
import { ChestComponent } from '../components/chest-component';
import { InventoryComponent } from '../components/inventory-component';

export class Chest extends ex.Actor {
    constructor(pos: ex.Vector, title: string = '木箱') {
        super({
            pos,
            width: 18,
            height: 14,
            anchor: ex.Vector.Half,
            z: 3
        });

        this.addComponent(new ChestComponent(title));
        this.addComponent(new InventoryComponent());
        this.body.collisionType = ex.CollisionType.Passive;
        this.addTag('chest');
    }

    override onInitialize(): void {
        this.graphics.use(new ex.Rectangle({
            width: 18,
            height: 14,
            color: ex.Color.fromHex('#8b5a2b'),
            strokeColor: ex.Color.fromHex('#3d2510'),
            lineWidth: 2
        }));
    }
}