// components/player-control-component.ts
import * as ex from 'excalibur';

export class PlayerControlComponent extends ex.Component {
    public readonly type = 'player-control';
    constructor(public speed: number = 25) {
        super();
    }
}