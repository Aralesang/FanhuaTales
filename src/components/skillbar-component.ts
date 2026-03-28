import { GridContainerComponent } from './grid-container-component';
import { ItemType } from '../item-base';

/**
 * 技能栏组件：
 * - 与背包/箱子/快捷栏共享同一容器抽象
 * - 当前阶段先作为可迁移的统一网格容器数据节点
 * - 未来可根据技能道具化方案收敛 acceptedTypes
 */
export class SkillbarComponent extends GridContainerComponent {
    public readonly type = 'skillbar';

    constructor(options?: {
        gridWidth?: number;
        gridHeight?: number;
        acceptedTypes?: ItemType[];
    }) {
        super({
            kind: 'skillbar',
            gridWidth: options?.gridWidth ?? 6,
            gridHeight: options?.gridHeight ?? 1,
            allowRotate: false,
            acceptedTypes: options?.acceptedTypes
        });
    }
}