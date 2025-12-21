import * as ex from 'excalibur';

export class DirectionComponent extends ex.Component {
    public direction: ex.Vector;
    constructor(direction: ex.Vector) {
        super();
        this.direction = direction;
    }
}