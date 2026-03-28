import * as ex from 'excalibur';

type HoverTooltipOptions = {
    width: number;
    height: number;
    z: number;
    backgroundColor: ex.Color;
    borderColor: ex.Color;
    borderWidth: number;
    fontFamily: string;
    fontSize: number;
    fontColor: ex.Color;
    textOffsetX: number;
    textOffsetY: number;
};

const DEFAULT_OPTIONS: HoverTooltipOptions = {
    width: 220,
    height: 70,
    z: 1100,
    backgroundColor: ex.Color.fromHex('#111111dd'),
    borderColor: ex.Color.White,
    borderWidth: 1,
    fontFamily: 'Arial',
    fontSize: 14,
    fontColor: ex.Color.White,
    textOffsetX: 12,
    textOffsetY: 10
};

// 通用悬停提示组件：
// 1. 通过 attachTo 挂载到任意 ScreenElement/Actor。
// 2. 由上层传入文本与锚点，组件只负责显示与隐藏。
export class HoverTooltip {
    private readonly panel: ex.Actor;
    private readonly label: ex.Label;

    constructor(options?: Partial<HoverTooltipOptions>) {
        const cfg = { ...DEFAULT_OPTIONS, ...options };

        this.panel = new ex.Actor({
            pos: ex.vec(0, 0),
            width: cfg.width,
            height: cfg.height,
            z: cfg.z
        });

        this.panel.graphics.use(new ex.Rectangle({
            width: cfg.width,
            height: cfg.height,
            color: cfg.backgroundColor,
            strokeColor: cfg.borderColor,
            lineWidth: cfg.borderWidth
        }));
        this.panel.graphics.opacity = 0;

        this.label = new ex.Label({
            text: '',
            font: new ex.Font({
                family: cfg.fontFamily,
                size: cfg.fontSize,
                color: cfg.fontColor
            }),
            pos: ex.vec(-cfg.width / 2 + cfg.textOffsetX, -cfg.height / 2 + cfg.textOffsetY),
            z: cfg.z + 1
        });

        this.panel.addChild(this.label);
    }

    public attachTo(parent: ex.Actor) {
        parent.addChild(this.panel);
    }

    public show(text: string, anchor: ex.Vector, offset: ex.Vector) {
        this.label.text = text;
        this.panel.pos = anchor.add(offset);
        this.panel.graphics.opacity = 1;
    }

    public hide() {
        this.panel.graphics.opacity = 0;
    }
}