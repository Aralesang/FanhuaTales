import * as ex from 'excalibur';
import { Asset } from '../asset';

export class AnimationComponent extends ex.Component {
    private entityType: string;
    private actor: ex.Actor;
    /** 当前已经生成的动画 */
    private animationMap: Map<string, ex.Animation> = new Map();
    /** 当前动画 */
    private currentAnimationName: string = "";
    constructor(entityType: string, actor: ex.Actor) {
        super();
        this.entityType = entityType;
        this.actor = actor;
    }
    public changeAnimation(actor: ex.Actor, animType: string, direction: ex.Vector) {
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
        const spriteSheet = ex.SpriteSheet.fromImageSource({
            image: image,
            grid: imageData.grid
        });
        //拼接出动画全称
        const animName = `${imageName}_${direction.toString()}`;
        if (this.currentAnimationName == animName) {
            return;
        }
        let anim = this.animationMap.get(animName);
        if (direction.equals(ex.Vector.Left)) {
            actor.graphics.flipHorizontal = true;
        } else if (direction.equals(ex.Vector.Right)) {
            actor.graphics.flipHorizontal = false;
        }
        if (anim == undefined) {
            //根据方向决定播放第几行的动画
            let row = 0;
            if (direction.equals(ex.Vector.Down)) {
                row = 1;
            } else if (direction.equals(ex.Vector.Up)) {
                row = 2;
            } else if (direction.equals(ex.Vector.Left)) {
                row = 0;
            } else if (direction.equals(ex.Vector.Right)) {
                row = 0;
            }
            anim = ex.Animation.fromSpriteSheet(spriteSheet, ex.range(row * imageData.grid.columns, (row + 1) * imageData.grid.columns - 1), 200);
            this.animationMap.set(animName, anim);
        }
        actor.graphics.use(anim);
    }
}