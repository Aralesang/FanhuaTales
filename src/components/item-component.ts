import * as ex from 'excalibur';
import { ItemBase } from '../item-base';

export class ItemComponent extends ex.Component {
    public readonly type = 'item';
    public item: ItemBase;

    constructor(item: ItemBase) {
        super();
        this.item = item;
    }
}