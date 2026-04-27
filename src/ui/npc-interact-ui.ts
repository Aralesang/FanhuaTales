import * as ex from 'excalibur';

type InteractCallback = (choice: 'talk' | 'shop') => void;

export class NPCInteractUI extends ex.ScreenElement {
    private background: ex.Rectangle;
    private isVisible: boolean = false;
    private onChoice: InteractCallback | null = null;
    private npcName: string = '商人';
    private buttons: ex.Actor[] = [];

    constructor() {
        super({
            x: 400,
            y: 300,
            width: 260,
            height: 160,
            anchor: ex.Vector.Half,
            z: 1300
        });

        this.background = new ex.Rectangle({
            width: 260,
            height: 160,
            color: ex.Color.fromHex('#1f1b18ee'),
            strokeColor: ex.Color.fromHex('#d7c5a3'),
            lineWidth: 2
        });
    }

    public show(npcName: string, onChoice: InteractCallback) {
        this.npcName = npcName;
        this.onChoice = onChoice;
        this.isVisible = true;
        this.graphics.use(this.background);
        this.buildUI();
    }

    public hide() {
        this.isVisible = false;
        this.onChoice = null;
        this.graphics.hide();
        this.clearButtons();
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

        const talkBtn = this.createButton('对话', -30, () => {
            this.onChoice?.('talk');
        });
        this.addChild(talkBtn);
        this.buttons.push(talkBtn);

        const shopBtn = this.createButton('商店', 20, () => {
            this.onChoice?.('shop');
        });
        this.addChild(shopBtn);
        this.buttons.push(shopBtn);
    }

    private createButton(text: string, y: number, onClick: () => void): ex.Actor {
        const btn = new ex.Actor({
            pos: ex.vec(0, y),
            width: 160,
            height: 36,
            z: 1301
        });

        btn.graphics.use(new ex.Rectangle({
            width: 160,
            height: 36,
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

        btn.on('pointerdown', () => onClick());

        return btn;
    }

    private clearButtons() {
        this.buttons.forEach(btn => this.removeChild(btn));
        this.buttons = [];
    }
}
