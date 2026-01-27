import * as ex from 'excalibur';

export class DirectionComponent extends ex.Component {
    private _direction: ex.Vector;
    constructor(direction: ex.Vector) {
        super();
        this._direction = direction;
    }

    public set direction(direction: ex.Vector) {
        this._direction = direction;
    }

    public get direction(){
        return this._direction;
    }
}