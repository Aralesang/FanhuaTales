/**
 * 全局字体配置
 *
 * 修改此文件即可统一调整游戏内所有文本字体。
 * 所有 UI System 均通过此配置读取字体族和字号。
 */

export const FontConfig = {
    /** 小字号（物品数量、标签、描述、按钮等） */
    small: {
        family: 'system-ui',
        size: '12px',
    },
    /** 大字号（标题、物品名称、重要数值等） */
    large: {
        family: 'system-ui',
        size: '16px',
    },
    /** 超小字号（辅助标签、装备栏子标签等） */
    tiny: {
        family: 'system-ui',
        size: '10px',
    },
} as const;
