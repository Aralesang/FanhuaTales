import { Scene } from 'phaser';

interface GridConfig {
    rows: number;
    columns: number;
    spriteWidth: number;
    spriteHeight: number;
}

interface ImageConfig {
    path: string;
    grid: GridConfig;
    animationStrategy: 'loop' | 'freeze';
}

interface ImagesMap {
    [key: string]: ImageConfig;
}

interface MapsMap {
    [key: string]: string;
}

interface SoundsMap {
    [key: string]: string;
}

export class BootScene extends Scene {
    private imagesMap!: ImagesMap;
    private mapsMap!: MapsMap;
    private soundsMap!: SoundsMap;

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
        this.load.json('imagesMap', 'data/images-map.json');
        this.load.json('mapsMap', 'data/maps-map.json');
        this.load.json('soundsMap', 'data/sounds-map.json');
        this.load.json('itemsMap', 'data/items-map.json');
        this.load.json('dropsMap', 'data/drops-map.json');
    }

    async create(): Promise<void> {
        // 等待自定义位图字体加载完成
        await this.loadFonts();

        this.imagesMap = this.cache.json.get('imagesMap') as ImagesMap;
        this.mapsMap = this.cache.json.get('mapsMap') as MapsMap;
        this.soundsMap = this.cache.json.get('soundsMap') as SoundsMap;

        // 获取默认场景（maps-map.json 的第一个条目）
        const defaultMapKey = Object.keys(this.mapsMap)[0];
        const mapPath = this.mapsMap[defaultMapKey].replace('.tmx', '.json');

        // 加载角色 spritesheets
        for (const [key, config] of Object.entries(this.imagesMap)) {
            this.load.spritesheet(key, config.path, {
                frameWidth: config.grid.spriteWidth,
                frameHeight: config.grid.spriteHeight
            });
        }

        // 加载地图 JSON（需要先从 Tiled 导出为同名 .json）
        this.load.tilemapTiledJSON(defaultMapKey, mapPath);

        // 预加载 tileset 图片（key 与 tileset name 对应）
        this.load.image('surface', 'images/map/village/FDR_Ground_Tiles.png');
        this.load.image('building', 'images/map/village/FDR_Village.png');
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
        for (const [key, config] of Object.entries(this.imagesMap)) {
            const { rows, columns } = config.grid;
            if (rows !== 3) continue;

            const directions = [
                { suffix: 'right', start: 0, end: columns - 1 },
                { suffix: 'down', start: columns, end: 2 * columns - 1 },
                { suffix: 'up', start: 2 * columns, end: 3 * columns - 1 }
            ];

            for (const dir of directions) {
                this.anims.create({
                    key: `${key}_${dir.suffix}`,
                    frames: this.anims.generateFrameNumbers(key, {
                        start: dir.start,
                        end: dir.end
                    }),
                    frameRate: 10,
                    repeat: config.animationStrategy === 'loop' ? -1 : 0
                });
            }
        }

        // 将默认地图 key 传递给 GameScene
        const defaultMapKey = Object.keys(this.mapsMap)[0];
        this.scene.start('GameScene', { mapKey: defaultMapKey });
    }
}
