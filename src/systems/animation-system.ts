import * as ex from 'excalibur';
import { StateMachineComponent } from '../components/state-machine-component';
import { AnimationComponent } from '../components/animation-component';
import { DirectionComponent } from '../components/direction-component';
import { Asset } from '../asset';
import { AnimationEvents } from '../events/animation-event';
export class AnimationSystem extends ex.System {
    systemType = ex.SystemType.Update;
    public query!: ex.Query<
        typeof StateMachineComponent |
        typeof AnimationComponent |
        typeof DirectionComponent
    >;

    initialize(world: ex.World, scene: ex.Scene): void {
        console.log("AnimationSystem");
        this.query = world.query([StateMachineComponent, AnimationComponent, DirectionComponent]);
    }

    update(elapsed: number): void {
        for (const entity of this.query.entities) {
            const stateMachine = entity.get(StateMachineComponent).fsm;
            if (stateMachine == undefined) {
                continue;
            }
            const animation = entity.get(AnimationComponent);
            // //获取方向
            let direction: ex.Vector = entity.get(DirectionComponent).direction;
            // if (!direction.equals(animation.currentDirection)) {
            //     animation.currentDirection = direction;
            // }
            if(!animation.initialized || animation.animType !== animation.currentAnimType || !direction.equals(animation.currentDirection)){
                console.log("切换动画:", animation.animType);
                animation.currentAnimType = animation.animType;
                animation.initialized = true;
                this.changeAnimation(entity as ex.Actor, animation, animation.currentAnimType, direction);
            }
        }
    }

    public changeAnimation(actor: ex.Actor, animation: AnimationComponent, animType: string, direction: ex.Vector) {
        //拼接出图片全称
        const imageName = `${animation.entityType}_${animType}`;
        const image = Asset.imageMap[imageName];
        if (!image) {
            console.error(`图片${imageName}不存在`);
            return;
        }
        const imageData = Asset.imageDataMap.get(imageName);
        if (imageData?.grid == undefined) {
            console.error(`图片${imageName}数据中缺失grid`);
            return;
        }
        const spriteSheet = ex.SpriteSheet.fromImageSource({
            image: image,
            grid: imageData.grid
        });
        animation.currentDirection = direction;
        const currentDirection = animation.currentDirection;
        //拼接出动画全称
        const animName = `${imageName}_${currentDirection.toString()}`;
        if (animation.currentAnimationName == animName) {
            return;
        }
        animation.animation = animation.animationMap.get(animName);
        if (currentDirection.equals(ex.Vector.Left)) {
            actor.graphics.flipHorizontal = true;
        } else if (currentDirection.equals(ex.Vector.Right)) {
            actor.graphics.flipHorizontal = false;
        }
        if (animation.animation == undefined) {
            //根据方向决定播放第几行的动画
            let row = 0;
            if (currentDirection.equals(ex.Vector.Down)) {
                row = 1;
            } else if (currentDirection.equals(ex.Vector.Up)) {
                row = 2;
            } else if (currentDirection.equals(ex.Vector.Left)) {
                row = 0;
            } else if (currentDirection.equals(ex.Vector.Right)) {
                row = 0;
            }
            animation.animation = ex.Animation.fromSpriteSheet(spriteSheet, ex.range(row * imageData.grid.columns, (row + 1) * imageData.grid.columns - 1), 100, imageData.animationStrategy);
            if (animation.animation) {
                if (animation.tint) {
                    animation.animation.tint = animation.tint;
                }
                if (imageData.animationStrategy !== ex.AnimationStrategy.Loop) {
                    animation.animation.events.on('end', () => {
                        actor.emit(AnimationEvents.AnimationComplete, animation);
                    });
                }
                animation.animationMap.set(animName, animation.animation);
            }
        }
        if (animation.animation) {
            animation.animation.reset();
            actor.graphics.use(animation.animation);
        }
    }

    //  public changeDirection(direction: Vector) {
    //     this.currentDirection = direction;
    //     this.changeAnimation(this.actor, this.currentAnimType, direction);
    // }
}