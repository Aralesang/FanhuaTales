import { Scene } from 'phaser';
import { System } from '../ecs/System';
import { Entity } from '../ecs/Entity';
import { HealthComponent, SpriteComponent, VisualComponent, DropComponent, GroundItemComponent } from '../ecs/Component';

interface DropEntry {
    itemId: string;
    chance: number;
    minQuantity: number;
    maxQuantity: number;
}

interface DropTable {
    description: string;
    drops: DropEntry[];
}

export class DropSystem extends System {
    private dropsMap!: Record<string, DropTable>;
    private processed: WeakMap<Entity, boolean> = new WeakMap();

    /** 地面掉落物的显示尺寸（像素），相对小一点避免覆盖角色脚下 */
    private readonly GROUND_ITEM_SIZE = 10;

    constructor(scene: Scene) {
        super(scene);
        this.dropsMap = scene.cache.json.get('drops') as Record<string, DropTable>;
    }

    update(entities: Entity[], _delta: number): void {
        for (const entity of entities) {
            if (!entity.hasComponent('health') || !entity.hasComponent('drop')) continue;
            if (this.processed.get(entity)) continue;

            const health = entity.getComponent<HealthComponent>('health')!;
            if (health.hp <= 0) {
                this.processed.set(entity, true);
                this.spawnDrops(entity, entities);
            }
        }
    }

    private spawnDrops(entity: Entity, entities: Entity[]): void {
        const drop = entity.getComponent<DropComponent>('drop')!;
        const table = this.dropsMap[drop.dropTable];
        if (!table) return;

        const sprite = entity.getComponent<SpriteComponent>('sprite')?.sprite;
        const originX = sprite?.x ?? 0;
        const originY = sprite?.y ?? 0;

        for (const entry of table.drops) {
            if (Math.random() >= entry.chance) continue;

            const quantity = Math.floor(
                Math.random() * (entry.maxQuantity - entry.minQuantity + 1)
            ) + entry.minQuantity;

            const itemEntity = this.createGroundItem(originX, originY, entry.itemId, quantity);
            entities.push(itemEntity);
        }
    }

    private createGroundItem(x: number, y: number, itemId: string, quantity: number): Entity {
        // 使用道具图标作为纹理（找不到时自动回退 item_notfind）
        const textureKey = this.getItemTextureKey(itemId);

        // 随机偏移，避免多个掉落物完全重叠
        const offsetX = (Math.random() - 0.5) * 12;
        const offsetY = (Math.random() - 0.5) * 12;

        const sprite = this.scene.add.sprite(x + offsetX, y + offsetY, textureKey);
        sprite.setDisplaySize(this.GROUND_ITEM_SIZE, this.GROUND_ITEM_SIZE);
        sprite.setDepth(50);

        const item = new Entity(this.scene);
        item.addComponent(new SpriteComponent(sprite));
        item.addComponent(new GroundItemComponent(itemId, quantity));

        const visual = new VisualComponent();
        visual.width = this.GROUND_ITEM_SIZE;
        visual.height = this.GROUND_ITEM_SIZE;
        item.addComponent(visual);

        return item;
    }
}
