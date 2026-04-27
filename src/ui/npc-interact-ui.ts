import * as ex from 'excalibur';

type InteractCallback = (choice: 'talk' | 'shop') => void;

export class NPCInteractUI extends ex.ScreenElement {
    private background: ex.Rectangle;
    private isVisible: boolean = false;
    private onChoice: InteractCallback | null = null;
    private npcName: string = '商人';
    private buttons: ex.Actor[] = [];
    private engine: ex.Engine;
    private readonly boundPointerDown: (event: ex.PointerEvent) => void;

    private readonly UI_X = 400;
    private readonly UI_Y = 300;
    private readonly BTN_WIDTH = 160;
    private readonly BTN_HEIGHT = 36;

    constructor(engine: ex.Engine) {
        super({
            x: 400,
            y: 300,
            width: 260,
            height: 160,
            anchor: ex.Vector.Half,
            z: 1300
        });

        this.engine = engine;
        this.background = new ex.Rectangle({
            width: 260,
            height: 160,
            color: ex.Color.fromHex('#1f1b18ee'),
            strokeColor: ex.Color.fromHex('#d7c5a3'),
            lineWidth: 2
        });

        this.boundPointerDown = (event) => this.handlePointerDown(event);
    }

    public show(npcName: string, onChoice: InteractCallback) {
        this.npcName = npcName;
        this.onChoice = onChoice;
        this.isVisible = true;
        this.graphics.use(this.background);
        this.graphics.visible = true;
        this.buildUI();
        this.engine.input.pointers.on('down', this.boundPointerDown);
    }

    public hide() {
        this.isVisible = false;
        this.onChoice = null;
        this.graphics.hide();
        this.clearButtons();
        this.engine.input.pointers.off('down', this.boundPointerDown);
    }

    public isOpen(): boolean {
        return this.isVisible;
    }

    private buildUI() {
        this.clearButtons();

        const titleLabel = new ex.Label({
            text: this.npcName,
            font: new ex.Font({ family: 'Arial', size: 20, color: ex.Color.fromHex('#d7c5a3'), textAlign: ex.TextAlign.Center }),
            pos: ex.vec(0, -50),
            z: 1301
        });
        this.addChild(titleLabel);
        this.buttons.push(titleLabel);

        const talkBtn = this.createButton('对话', -30);
        this.addChild(talkBtn);
        this.buttons.push(talkBtn);

        const shopBtn = this.createButton('商店', 20);
        this.addChild(shopBtn);
        this.buttons.push(shopBtn);
    }

    private createButton(text: string, y: number): ex.Actor {
        const btn = new ex.Actor({
            pos: ex.vec(0, y),
            width: this.BTN_WIDTH,
            height: this.BTN_HEIGHT,
            z: 1301
        });

        btn.graphics.use(new ex.Rectangle({
            width: this.BTN_WIDTH,
            height: this.BTN_HEIGHT,
            color: ex.Color.fromHex('#4a443c'),
            strokeColor: ex.Color.fromHex('#d7c5a3'),
            lineWidth: 1
        }));

        const label = new ex.Label({
            text,
            font: new ex.Font({ family: 'Arial', size: 16, color: ex.Color.White, textAlign: ex.TextAlign.Center }),
            pos: ex.vec(0, 0),
            z: 1302
        });
        btn.addChild(label);

        return btn;
    }

    private handlePointerDown(event: ex.PointerEvent) {
        const x = event.screenPos.x;
        const y = event.screenPos.y;

        const talkTop = this.UI_Y - 30 - this.BTN_HEIGHT / 2;
        const talkBottom = this.UI_Y - 30 + this.BTN_HEIGHT / 2;
        const talkLeft = this.UI_X - this.BTN_WIDTH / 2;
        const talkRight = this.UI_X + this.BTN_WIDTH / 2;

        if (x >= talkLeft && x <= talkRight && y >= talkTop && y <= talkBottom) {
            this.onChoice?.('talk');
            return;
        }

        const shopTop = this.UI_Y + 20 - this.BTN_HEIGHT / 2;
        const shopBottom = this.UI_Y + 20 + this.BTN_HEIGHT / 2;
        const shopLeft = this.UI_X - this.BTN_WIDTH / 2;
        const shopRight = this.UI_X + this.BTN_WIDTH / 2;

        if (x >= shopLeft && x <= shopRight && y >= shopTop && y <= shopBottom) {
            this.onChoice?.('shop');
            return;
        }
    }

    private clearButtons() {
        this.buttons.forEach(btn => this.removeChild(btn));
        this.buttons = [];
    }
}
