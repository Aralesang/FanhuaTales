import * as ex from 'excalibur';

export class NPCComponent extends ex.Component {
    public readonly type = 'npc';
    public name: string;
    public interactDistance: number;

    constructor(name: string = '商人', interactDistance: number = 32) {
        super();
        this.name = name;
        this.interactDistance = interactDistance;
    }
}
