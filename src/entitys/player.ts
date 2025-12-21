import * as ex from 'excalibur';
import { StateMachineComponent } from '../components/state-machine-component';
import { AnimationComponent } from '../components/animation-component';
import { DirectionComponent } from '../components/direction-component';

/** 玩家实体 */
export class Player extends ex.Actor {
    constructor() {
        super({
            pos: new ex.Vector(0, 0),
            width: 16,
            height: 16
        });
        //附加方向组件
        this.addComponent(new DirectionComponent(ex.Vector.Down));
        //附加状态机组件
        this.addComponent(new StateMachineComponent());
        //附加动画组件
        this.addComponent(new AnimationComponent("human", this));
        this.addTag("player");
    }
}