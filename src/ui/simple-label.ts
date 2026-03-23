import * as ex from 'excalibur';

/**
 * 最简 UI 范例：左上角显示一个黄色文字标签
 * 只需 scene.add(new SimpleLabel("Hello!")) 即可显示
 */
export class SimpleLabel extends ex.ScreenElement {
    private _msg: string;

    constructor(message: string) {
        super({
            x: 10,
            y: 10,
            z: 9999,
            anchor: ex.Vector.Zero
        });
        this._msg = message;
    }

    override onInitialize(_engine: ex.Engine): void {
        this.graphics.use(new ex.Text({
            text: this._msg,
            font: new ex.Font({
                family: 'Arial',
                size: 20,
                color: ex.Color.Yellow
            })
        }));
    }
}
