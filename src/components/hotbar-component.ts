import { GridContainerComponent } from './grid-container-component';
import { ItemType } from '../item-base';

/**
 * 快捷栏组件：
 * - 每个物品只占一个格子（默认 8x1）
 * - 作为可快速使用的物品入口
 * - 当前阶段默认允许所有类型，后续可通过 acceptedTypes 做规则收敛
 */
export class HotbarComponent extends GridContainerComponent {
    public readonly type = 'hotbar';

    constructor(options?: {
        gridWidth?: number;
        gridHeight?: number;
        acceptedTypes?: ItemType[];
    }) {
        super({
            kind: 'hotbar',
            gridWidth: options?.gridWidth ?? 8,
            gridHeight: options?.gridHeight ?? 1,
            acceptedTypes: options?.acceptedTypes
        });
    }
}
