import * as ex from 'excalibur';
import { LootDropComponent, LootDropTableConfig } from '../components/loot-drop-component';
import { DeathMarkerComponent } from '../components/death-marker-component';
import { Asset } from '../asset';
import { ItemFactory } from '../item-base';
import { Item } from '../entitys/item';

/**
 * 战利品掉落系统 —— 处理敌人死亡时的物品掉落逻辑
 *
 * 工作流：
 * 1. DamageSystem 检测到实体死亡时，附加 DeathMarkerComponent（不直接 kill）
 * 2. LootDropSystem 每帧查询带有 DeathMarkerComponent 且尚未处理的实体
 * 3. 若实体同时带有 LootDropComponent，读取对应掉落表配置，按概率计算掉落
 * 4. 生成 Item 实体到场景中，并散布在敌人死亡位置周围
 * 5. 标记 DeathMarkerComponent.processed = true，由 DamageSystem 下一帧执行 kill()
 *
 * 掉落配置说明：
 * - 配置文件位于 public/data/drops-map.json
 * - 每种敌人类型对应一个掉落表（如 goblin、orc）
 * - 每个掉落表包含多个 DropEntryConfig，每个条目有独立的掉落概率和数量范围
 * - 同一个敌人死亡时，每个掉落条目独立判定，可能同时掉落多种物品
 * - 如果指定的掉落表 key 不存在，自动回退到 'default_enemy'
 */
export class LootDropSystem extends ex.System {
    systemType = ex.SystemType.Update;

    public deathQuery!: ex.Query<typeof DeathMarkerComponent>;

    private dropTableCache: Map<string, LootDropTableConfig> = new Map();

    private scene!: ex.Scene;

    initialize(world: ex.World, scene: ex.Scene): void {
        console.log('LootDropSystem initialized');
        this.deathQuery = world.query([DeathMarkerComponent]);
        this.scene = scene;
    }

    update(elapsed: number): void {
        for (const entity of this.deathQuery.entities) {
            const marker = entity.get(DeathMarkerComponent);
            if (!marker || marker.processed) {
                continue;
            }

            const lootComp = entity.get(LootDropComponent);
            if (lootComp) {
                this.processLootDrop(entity as ex.Actor, lootComp);
            }

            marker.processed = true;
        }
    }

    private processLootDrop(actor: ex.Actor, lootComp: LootDropComponent): void {
        const dropTable = this.getDropTable(lootComp.dropTableKey);
        if (!dropTable || !dropTable.drops || dropTable.drops.length === 0) {
            console.warn(`[LootDropSystem] 掉落表 "${lootComp.dropTableKey}" 为空或不存在`);
            return;
        }

        const deathPos = actor.pos;

        for (const entry of dropTable.drops) {
            const roll = Math.random();
            if (roll > entry.chance) {
                continue;
            }

            const quantity = this.randomInt(entry.minQuantity, entry.maxQuantity);
            if (quantity <= 0) {
                continue;
            }

            const itemConfig = Asset.itemDataMap?.get(entry.itemId);
            if (!itemConfig) {
                console.warn(`[LootDropSystem] 物品配置 "${entry.itemId}" 不存在于 items-map.json 中`);
                continue;
            }

            const item = ItemFactory.fromConfig(itemConfig);
            item.quantity = quantity;

            const dropPos = this.randomScatterPosition(deathPos, lootComp.scatterRadius);

            const itemActor = new Item(dropPos, item);
            this.scene.add(itemActor);

            console.log(
                `[LootDropSystem] "${actor.name}" 掉落了 ${quantity}x ${item.name} (概率判定: ${roll.toFixed(3)} <= ${entry.chance})`
            );
        }
    }

    private getDropTable(key: string): LootDropTableConfig | undefined {
        if (this.dropTableCache.has(key)) {
            return this.dropTableCache.get(key);
        }

        const config = Asset.dropDataMap?.get(key);
        if (config) {
            const table = config as LootDropTableConfig;
            this.dropTableCache.set(key, table);
            return table;
        }

        if (key !== 'default_enemy') {
            console.warn(`[LootDropSystem] 掉落表 "${key}" 未找到，回退到 default_enemy`);
            return this.getDropTable('default_enemy');
        }

        return undefined;
    }

    private randomScatterPosition(center: ex.Vector, radius: number): ex.Vector {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        return ex.vec(
            center.x + Math.cos(angle) * distance,
            center.y + Math.sin(angle) * distance
        );
    }

    private randomInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}
