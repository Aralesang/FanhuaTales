import { Scene } from 'phaser';
import { Entity } from './Entity';

export abstract class System {
    protected scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    abstract update(entities: Entity[], delta: number): void;
}
