import * as ex from "excalibur";
import { PlayerComponent } from "../components/player-component";
import { ItemComponent } from "../components/item-component";
import { InventorySystem } from "./inventory-system";

/** 物品拾取系统 */
export class PickupSystem extends ex.System {
    systemType: ex.SystemType = ex.SystemType.Update;
    public query!: ex.Query<
        typeof PlayerComponent
    >;
    private world!: ex.World;

    initialize(world: ex.World, scene: ex.Scene): void {
        console.log("PickupSystem initialized");
        this.world = world;
        this.query = world.query([PlayerComponent]);
    }

    update(elapsed: number): void {
        for (const player of this.query.entities) {
            // 检查玩家与物品的碰撞
            const items = this.world.query([ItemComponent]).entities;
            const playerTransform = player.get(ex.TransformComponent);
            if (!playerTransform) continue;
            const playerPos = playerTransform.pos;
            for (const itemEntity of items) {
                const itemTransform = itemEntity.get(ex.TransformComponent);
                if (!itemTransform) continue;
                const itemPos = itemTransform.pos;
                if (playerPos.distance(itemPos) < 10) { // 简单距离检查，实际应该用碰撞检测
                    InventorySystem.handleItemPickup(player, itemEntity);
                }
            }
        }
    }
}