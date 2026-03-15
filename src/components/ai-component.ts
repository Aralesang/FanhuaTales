import * as ex from 'excalibur';

export class AIComponent extends ex.Component {
    public readonly type = 'ai';
    constructor(
        public speed: number = 30,
        public chaseRadius: number = 120,
        public attackCooldown: number = 1000,
        public lastAttackTime: number = 0
    ) {
        super();
    }
}