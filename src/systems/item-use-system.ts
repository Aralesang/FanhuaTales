import * as ex from 'excalibur';
import { ItemBase, ItemUseEffect } from '../item-base';
import { HealthComponent } from '../components/health-component';
import { ItemUseRequestComponent } from '../components/item-use-request-component';
import { InventoryComponent } from '../components/inventory-component';
import { HotbarComponent } from '../components/hotbar-component';
import { InventorySystem } from './inventory-system';

/** 物品使用系统 */
export class ItemUseSystem extends ex.System {
    systemType: ex.SystemType = ex.SystemType.Update;
    public query!: ex.Query<typeof ItemUseRequestComponent>;

    initialize(world: ex.World, scene: ex.Scene): void {
        console.log("ItemUseSystem initialized");
        this.query = world.query([ItemUseRequestComponent]);
    }

    update(elapsed: number): void {
        // 处理所有待处理的物品使用请求（完全数据驱动）
        for (const entity of this.query.entities) {
            const request = entity.get(ItemUseRequestComponent);
            if (!request) continue;

            // 轮询清除标记
            if (request.clearFlag) {
                request.itemToUse = null;
                request.user = null;
                request.target = null;
                request.requestTime = 0;
                request.processed = false;
                request.success = false;
                request.clearFlag = false;
                continue;
            }

            // 轮询待处理请求
            if (request.itemToUse !== null && !request.processed) {
                this.processItemUseRequest(entity, request);
            }
        }

        // 这里可以添加持续效果的更新逻辑，比如buff倒计时
    }

    /** 处理物品使用请求 */
    private processItemUseRequest(entity: ex.Entity, request: ItemUseRequestComponent): void {
        if (!request.itemToUse || !request.user) {
            request.processed = true;
            request.success = false;
            return;
        }

        const item = request.itemToUse;
        const user = request.user;
        const target = request.target;

        console.log(`处理物品使用请求: ${item.name}`);

        // 执行使用逻辑
        request.success = this.applyItemEffect(item, user, target || undefined);
        request.processed = true;
        

        // 触发使用完成事件
        this.onItemUseCompleted(entity, request);
    }

    /** 应用物品效果 */
    private applyItemEffect(item: ItemBase, user: ex.Entity, target?: ex.Entity): boolean {
        if (!item.usable || !item.useEffect) {
            console.log(`${item.name} 不能使用或没有使用效果`);
            return false;
        }

        const effect = item.useEffect;
        const actualTarget = target || (effect.target === 'self' ? user : null);

        if (!actualTarget) {
            console.log(`${item.name} 需要指定目标`);
            return false;
        }

        switch (effect.type) {
            case 'heal':
                return this.applyHealEffect(actualTarget, effect.value || 0);
            case 'damage':
                return this.applyDamageEffect(actualTarget, effect.value || 0);
            case 'buff':
                return this.applyBuffEffect(actualTarget, effect);
            case 'teleport':
                return this.applyTeleportEffect(actualTarget, effect);
            case 'custom':
                return this.applyCustomEffect(actualTarget, effect);
            default:
                console.log(`${item.name} 未知效果类型: ${effect.type}`);
                return false;
        }
    }

    private applyHealEffect(target: ex.Entity, healAmount: number): boolean {
        const health = target.get(HealthComponent);
        if (health) {
            health.hp = Math.min(health.maxHp, health.hp + healAmount);
            console.log(`${target.name || '目标'} 恢复 ${healAmount} 点生命，当前生命 ${health.hp}/${health.maxHp}`);
            return true;
        }
        console.log('目标没有生命组件，无法治疗');
        return false;
    }

    private applyDamageEffect(target: ex.Entity, damageAmount: number): boolean {
        const health = target.get(HealthComponent);
        if (health) {
            health.hp = Math.max(0, health.hp - damageAmount);
            console.log(`${target.name || '目标'} 受到 ${damageAmount} 点伤害，当前生命 ${health.hp}/${health.maxHp}`);
            return true;
        }
        console.log('目标没有生命组件，无法造成伤害');
        return false;
    }

    private applyBuffEffect(target: ex.Entity, effect: ItemUseEffect): boolean {
        // 这里可以添加buff逻辑，比如临时增加属性
        console.log(`${target.name || '目标'} 获得buff效果: ${effect.type}, 值: ${effect.value}, 持续时间: ${effect.duration}`);
        // TODO: 实现buff系统
        return true;
    }

    private applyTeleportEffect(target: ex.Entity, effect: ItemUseEffect): boolean {
        // 这里可以添加传送逻辑
        console.log(`${target.name || '目标'} 传送效果: ${effect.type}`);
        // TODO: 实现传送逻辑
        return true;
    }

    private applyCustomEffect(target: ex.Entity, effect: ItemUseEffect): boolean {
        // 自定义效果，可以通过事件或其他方式扩展
        console.log(`${target.name || '目标'} 自定义效果: ${effect.type}`);
        // TODO: 实现自定义逻辑
        return true;
    }

    /** 物品使用完成回调 */
    private onItemUseCompleted(entity: ex.Entity, request: ItemUseRequestComponent): void {
        if (request.success && request.itemToUse && request.user) {
            console.log(`物品 ${request.itemToUse.name} 使用成功`);

            // 消耗物品（通过数据驱动的方式）
            // 先尝试从主背包消耗，若未找到则尝试快捷栏
            const inventory = request.user.get(InventoryComponent);
            const hotbar = request.user.get(HotbarComponent);
            let consumed = false;

            if (inventory && InventorySystem.getItem(inventory, request.itemToUse.uid)) {
                consumed = InventorySystem.consumeItemAfterUse(inventory, request.itemToUse.uid, 1);
            }
            if (!consumed && hotbar && InventorySystem.getItem(hotbar, request.itemToUse.uid)) {
                consumed = InventorySystem.consumeItemAfterUse(hotbar, request.itemToUse.uid, 1);
            }

            if (!consumed) {
                console.warn(`无法消耗物品 ${request.itemToUse.name}：未在背包或快捷栏中找到`);
            }

            // 可以在这里触发事件、播放音效、显示特效等
        } else {
            console.log(`物品使用失败`);
        }

        // 标记清除，下一轮 update 由系统统一清除数据
        request.clearFlag = true;
    }
}