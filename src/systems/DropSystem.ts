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

    private readonly itemColors: Record<string, number> = {
        health_potion: 0xcc3333,
        iron_sword: 0x888888,
        gold_coin: 0xffcc00,
        leather_armor: 0x8b5a2b,
        wooden_helmet: 0xa0522d,
    };

    constructor(scene: Scene) {
        super(scene);
        this.dropsMap = scene.cache.json.get('dropsMap') as Record<string, DropTable>;
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
        // 生成掉落物纹理（首次使用时创建）
        const textureKey = `drop_${itemId}`;
        if (!this.scene.textures.exists(textureKey)) {
            const gfx = this.scene.make.graphics({ x: 0, y: 0 }, false);
            gfx.fillStyle(this.itemColors[itemId] ?? 0xaaaaaa, 1);
            gfx.fillRect(0, 0, 6, 6);
            gfx.generateTexture(textureKey, 6, 6);
        }

        // 随机偏移，避免多个掉落物完全重叠
        const offsetX = (Math.random() - 0.5) * 12;
        const offsetY = (Math.random() - 0.5) * 12;

        const sprite = this.scene.add.sprite(x + offsetX, y + offsetY, textureKey);
        sprite.setDepth(50);

        const item = new Entity(this.scene);
        item.addComponent(new SpriteComponent(sprite));
        item.addComponent(new GroundItemComponent(itemId, quantity));

        const visual = new VisualComponent();
        visual.width = 6;
        visual.height = 6;
        item.addComponent(visual);

        return item;
    }
}
