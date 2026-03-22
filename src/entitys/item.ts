import * as ex from 'excalibur';
import { ItemComponent } from '../components/item-component';
import { ItemBase } from '../item-base';

/** 物品实体 */
export class Item extends ex.Actor {
    constructor(pos: ex.Vector, item: ItemBase) {
        super({
            pos: pos,
            width: 8,
            height: 8,
            anchor: ex.Vector.Half,
            z: 1
        });
        this.addComponent(new ItemComponent(item));
        this.body.collisionType = ex.CollisionType.Passive;
        this.addTag("item");
    }

    onInitialize(engine: ex.Engine): void {
        // 可以添加动画或精灵
        // 暂时用颜色表示
        this.graphics.use(new ex.Rectangle({
            width: 8,
            height: 8,
            color: ex.Color.Yellow
        }));
    }
}