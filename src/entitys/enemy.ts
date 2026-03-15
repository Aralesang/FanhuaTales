import * as ex from 'excalibur';
import { StateMachineComponent } from '../components/state-machine-component';
import { AnimationComponent } from '../components/animation-component';
import { DirectionComponent } from '../components/direction-component';
import { HealthComponent } from '../components/health-component';
import { AIComponent } from '../components/ai-component';

/** 敌人实体 */
export class Enemy extends ex.Actor {
    constructor(pos: ex.Vector) {
        super({
            pos: pos,
            width: 10,
            height: 8,
            anchor: new ex.Vector(0.5, 0.55),
            z: 4
        });
    }

    onInitialize(engine: ex.Engine): void {
        // 添加组件
        this.addComponent(new DirectionComponent(ex.Vector.Down));
        this.addComponent(new StateMachineComponent());
        this.addComponent(new AnimationComponent('human', this, ex.Color.Red));
        this.addComponent(new HealthComponent(3));
        this.addComponent(new AIComponent(30, 120, 1000));
        this.body.collisionType = ex.CollisionType.Active;
        this.addTag('enemy');
    }
}
