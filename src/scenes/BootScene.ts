import { Scene } from 'phaser';

interface GridConfig {
    rows: number;
    columns: number;
    spriteWidth: number;
    spriteHeight: number;
}

interface AnimationConfig {
    path: string;
    skins: string[];
    grid: GridConfig;
    animationStrategy: 'loop' | 'freeze';
}

interface AnimationMap {
    [key: string]: AnimationConfig;
}

interface MapsMap {
    [key: string]: string;
}

interface SoundsMap {
    [key: string]: string;
}

interface ItemsMap {
    [key: string]: { id: string };
}

export class BootScene extends Scene {
    private animationMap!: AnimationMap;
    private mapsMap!: MapsMap;
    private soundsMap!: SoundsMap;
    private itemsMap!: ItemsMap;

    constructor() {
        super({ key: 'BootScene' });
    }

    /** 等待 CSS @font-face 字体加载完成 */
    private async loadFonts(): Promise<void> {
        // 使用相对路径，确保在 file:// 协议下（Electron 生产模式）也能正确解析
        const fonts: FontFace[] = [
            new FontFace('VonwaonBitmap12', 'url(fonts/VonwaonBitmap-12px.ttf)'),
            new FontFace('VonwaonBitmap16', 'url(fonts/VonwaonBitmap-16px.ttf)'),
        ];
        for (const font of fonts) {
            try {
                const loaded = await font.load();
                document.fonts.add(loaded);
            } catch {
                console.warn(`[BootScene] 字体加载失败: ${font.family}`);
            }
        }
    }

    preload(): void {
        // 加载资源映射表
        this.load.json('animation', 'data/animation.json');
        this.load.json('maps', 'data/maps.json');
        this.load.json('sounds', 'data/sounds.json');
        this.load.json('items', 'data/items.json');
        this.load.json('drops', 'data/drops.json');
        this.load.json('buffs', 'data/buffs.json');
    }

    async create(): Promise<void> {
        // 等待自定义位图字体加载完成
        await this.loadFonts();

        this.animationMap = this.cache.json.get('animation') as AnimationMap;
        this.mapsMap = this.cache.json.get('maps') as MapsMap;
        this.soundsMap = this.cache.json.get('sounds') as SoundsMap;
        this.itemsMap = this.cache.json.get('items') as ItemsMap;

        // 加载角色 spritesheets（支持多皮肤）
        for (const [key, config] of Object.entries(this.animationMap)) {
            const basePath = config.path;
            // 规范化路径：确保以 / 结尾
            const normalizedPath = basePath.endsWith('/') ? basePath : basePath + '/';

            for (const skin of config.skins) {
                const skinName = skin.replace(/\.png$/i, '');
                const isDefault = skinName === 'default';
                const textureKey = isDefault ? key : `${key}_${skinName}`;
                const filePath = normalizedPath + skin;

                this.load.spritesheet(textureKey, filePath, {
                    frameWidth: config.grid.spriteWidth,
                    frameHeight: config.grid.spriteHeight,
                });
            }
        }

        // 加载缺图回退占位符：所有未找到纹理的统一回退
        this.load.image('item_notfind', 'images/notfind.png');
        for (const itemId of Object.keys(this.itemsMap)) {
            this.load.image(`item_${itemId}`, `images/item/${itemId}.png`);
        }
        // 加载失败时记录警告，渲染层会自动回退到 item_notfind
        this.load.on('loaderror', (file: { key: string }) => {
            if (file.key.startsWith('item_')) {
                console.warn(`[BootScene] 道具图标缺失: ${file.key}，将使用 notfind 占位`);
            }
        });

        // 加载所有地图 JSON（支持场景切换）
        for (const [key, path] of Object.entries(this.mapsMap)) {
            this.load.tilemapTiledJSON(key, path.replace('.tmx', '.json'));
        }

        // 预加载所有地图可能用到的 tileset 图片（key 与 Tiled 中 tileset name 对应）
        this.load.image('surface', 'images/map/village/FDR_Ground_Tiles.png');
        this.load.image('building', 'images/map/village/FDR_Village.png');
        this.load.image('interior', 'images/map/village/FG_Interior.png');
        this.load.image('solid', 'images/map/solid.png');

        // 加载音效
        for (const [key, path] of Object.entries(this.soundsMap)) {
            this.load.audio(key, path);
        }

        this.load.once('complete', this.onLoadComplete, this);
        this.load.start();
    }

    private onLoadComplete(): void {
        // 自动创建动画：仅对 3 行精灵表创建方向性动画（right / down / up）
        for (const [key, config] of Object.entries(this.animationMap)) {
            const { rows, columns } = config.grid;
            if (rows !== 3) continue;

            const directions = [
                { suffix: 'right', start: 0, end: columns - 1 },
                { suffix: 'down', start: columns, end: 2 * columns - 1 },
                { suffix: 'up', start: 2 * columns, end: 3 * columns - 1 },
            ];

            // 为 default 皮肤创建动画（兼容现有代码，使用原始 key）
            const hasDefault = config.skins.some(s => s.replace(/\.png$/i, '') === 'default');
            if (hasDefault) {
                for (const dir of directions) {
                    this.anims.create({
                        key: `${key}_${dir.suffix}`,
                        frames: this.anims.generateFrameNumbers(key, {
                            start: dir.start,
                            end: dir.end,
                        }),
                        frameRate: 10,
                        repeat: config.animationStrategy === 'loop' ? -1 : 0,
                    });
                }
            }

            // 为其他皮肤创建动画
            for (const skin of config.skins) {
                const skinName = skin.replace(/\.png$/i, '');
                if (skinName === 'default') continue;

                const textureKey = `${key}_${skinName}`;
                for (const dir of directions) {
                    this.anims.create({
                        key: `${textureKey}_${dir.suffix}`,
                        frames: this.anims.generateFrameNumbers(textureKey, {
                            start: dir.start,
                            end: dir.end,
                        }),
                        frameRate: 10,
                        repeat: config.animationStrategy === 'loop' ? -1 : 0,
                    });
                }
            }
        }

        // 将默认地图 key 传递给 GameScene
        const defaultMapKey = Object.keys(this.mapsMap)[0];
        this.scene.start('GameScene', { mapKey: defaultMapKey });
    }
}
