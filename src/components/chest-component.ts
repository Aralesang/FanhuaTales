import * as ex from 'excalibur';

export class ChestComponent extends ex.Component {
    public readonly type = 'chest';
    public title: string;
    public interactDistance: number;

    constructor(title: string = '木箱', interactDistance: number = 28) {
        super();
        this.title = title;
        this.interactDistance = interactDistance;
    }
}