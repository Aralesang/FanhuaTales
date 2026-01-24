import { Component, Actor, Vector, SpriteSheet, range, Animation } from 'excalibur';
import { Asset } from '../asset';

export class AnimationComponent extends Component {
    private entityType: string;
    private actor: Actor;
    /** 当前已经生成的动画 */
    private animationMap: Map<string, Animation> = new Map();
    /** 当前动画 */
    private currentAnimationName: string = "";
    constructor(entityType: string, actor: Actor) {
        super();
        this.entityType = entityType;
        this.actor = actor;
    }
    public changeAnimation(actor: Actor, animType: string, direction: Vector) {
        //拼接出图片全称
        const imageName = `${this.entityType}_${animType}`;
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
        const spriteSheet = SpriteSheet.fromImageSource({
            image: image,
            grid: imageData.grid
        });
        //拼接出动画全称
        const animName = `${imageName}_${direction.toString()}`;
        if (this.currentAnimationName == animName) {
            return;
        }
        let anim = this.animationMap.get(animName);
        if (direction.equals(Vector.Left)) {
            actor.graphics.flipHorizontal = true;
        } else if (direction.equals(Vector.Right)) {
            actor.graphics.flipHorizontal = false;
        }
        if (anim == undefined) {
            //根据方向决定播放第几行的动画
            let row = 0;
            if (direction.equals(Vector.Down)) {
                row = 1;
            } else if (direction.equals(Vector.Up)) {
                row = 2;
            } else if (direction.equals(Vector.Left)) {
                row = 0;
            } else if (direction.equals(Vector.Right)) {
                row = 0;
            }
            anim = Animation.fromSpriteSheet(spriteSheet, range(row * imageData.grid.columns, (row + 1) * imageData.grid.columns - 1), 200);
            this.animationMap.set(animName, anim);
        }
        actor.graphics.use(anim);
    }
}