import { Scene } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { SpriteComponent, InventoryComponent, GroundItemComponent, ItemDefinition } from '../ecs/Component';
import { InventorySystem } from './InventorySystem';

export class PickupSystem extends System {
    /** 拾取半径（像素，世界坐标） */
    private readonly PICKUP_RADIUS = 15;

    constructor(scene: Scene) {
        super(scene);
    }

    update(entities: Entity[], _delta: number): void {
        const player = entities.find(e => e.hasComponent('inventory') && e.hasComponent('player'));
        if (!player) return;

        const playerSprite = player.getComponent<SpriteComponent>('sprite')?.sprite;
        if (!playerSprite) return;

        const playerInventory = player.getComponent<InventoryComponent>('inventory')!;
        const itemsMap = this.scene.cache.json.get('itemsMap') as Record<string, ItemDefinition>;

        for (const entity of entities) {
            if (!entity.hasComponent('grounditem')) continue;

            const itemSprite = entity.getComponent<SpriteComponent>('sprite')?.sprite;
            if (!itemSprite) continue;

            const dx = playerSprite.x - itemSprite.x;
            const dy = playerSprite.y - itemSprite.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= this.PICKUP_RADIUS) {
                const groundItem = entity.getComponent<GroundItemComponent>('grounditem')!;
                InventorySystem.addItem(playerInventory, itemsMap, groundItem.itemId, groundItem.quantity);
                entity.destroy();
            }
        }
    }
}
