import * as ex from 'excalibur';
import { StateMachineComponent } from '../components/state-machine-component';
import { AnimationComponent } from '../components/animation-component';
import { DirectionComponent } from '../components/direction-component';
import { PlayerControlComponent } from '../components/player-control-component';
import { HealthComponent } from '../components/health-component';
import { PlayerComponent } from '../components/player-component';

/** 玩家实体 */
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
        //附加玩家组件
        this.addComponent(new PlayerComponent());
        //附加方向组件
        this.addComponent(new DirectionComponent(ex.Vector.Down));
        //附加状态机组件
        this.addComponent(new StateMachineComponent());
        //附加动画组件
        this.addComponent(new AnimationComponent("human", this));
        // 附加生命（可被敌人攻击）
        this.addComponent(new HealthComponent(5));
        this.body.collisionType = ex.CollisionType.Active;
        this.addTag("player");
        //检查是否是需要被控制的玩家
        if (this.isControl) {
            this.addComponent(new PlayerControlComponent(50));
        }
    }
}