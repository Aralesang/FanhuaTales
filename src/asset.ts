import { FactoryProps, TiledResource } from '@excaliburjs/plugin-tiled';
import * as ex from 'excalibur';
import { Player } from './entitys/player';

interface ImageDataMap {
    [key: string]: ImageData
}

interface ImageData {
    /** 图片路径 */
    path: string,
    grid: {
        /** 行数 */
        rows: number,
        /** 列数 */
        columns: number,
        /** 精灵宽度 */
        spriteWidth: number,
        /** 精灵高度 */
        spriteHeight: number
    },
    animationStrategy: ex.AnimationStrategy
}

export class Asset {
    public static imageMap: Record<string, ex.ImageSource> = {};
    public static imageDataMap: Map<string, ImageData>;
    public static tileMapMap: Record<string, TiledResource> = {};
    public static itemDataMap: Map<string, Record<string, any>>;
    public static dropDataMap: Map<string, Record<string, any>>;
    public static music: ex.Sound | undefined;
    public static sounds: Record<string, ex.Sound> = {};
    public static async init() {
        // --- 加载图片配置 ---
        const imagePathResource = new ex.Resource<ImageDataMap>("./data/images-map.json", "json");
        this.imageDataMap = new Map();
        const imageDataJson = await imagePathResource.load();
        console.log("获取图片路径", imageDataJson);
        for (const key in imageDataJson) {
            this.imageMap[key] = new ex.ImageSource(imageDataJson[key].path);
            this.imageDataMap.set(key, imageDataJson[key]);
        }

        // --- 加载地图配置 ---
        const mapsPathResource = new ex.Resource<Record<string, string>>("./data/maps-map.json", "json");
        const mapsDataJson = await mapsPathResource.load();
        console.log("获取地图路径", mapsDataJson);
        for (const key in mapsDataJson) {
            let tileMap = new TiledResource(mapsDataJson[key], {
                useTilemapCameraStrategy: true
            });
            this.tileMapMap[key] = tileMap;
        }

        // --- 加载音频资源配置 ---
        try {
            const soundsPathResource = new ex.Resource<Record<string, string>>("./data/sounds-map.json", "json");
            const soundsDataJson = await soundsPathResource.load();
            console.log("获取音效路径", soundsDataJson);

            // 加载背景音乐 (约定 key 为 'music')
            if (soundsDataJson['music']) {
                this.music = new ex.Sound(soundsDataJson['music']);
            }

            // 加载其他音效
            for (const key in soundsDataJson) {
                if (key !== 'music') {
                    this.sounds[key] = new ex.Sound(soundsDataJson[key]);
                }
            }
        } catch (e) {
            console.warn("音频资源加载初始化失败", e);
        }

        // --- 加载物品配置 ---
        try {
            const itemPathResource = new ex.Resource<Record<string, any>>("./data/items-map.json", "json");
            const itemDataJson = await itemPathResource.load();
            console.log("获取物品配置", itemDataJson);
            this.itemDataMap = new Map();
            for (const key in itemDataJson) {
                this.itemDataMap.set(key, itemDataJson[key]);
            }
        } catch (e) {
            console.warn("物品配置加载初始化失败", e);
            this.itemDataMap = new Map();
        }

        // --- 加载掉落配置 ---
        try {
            const dropPathResource = new ex.Resource<Record<string, any>>("./data/drops-map.json", "json");
            const dropDataJson = await dropPathResource.load();
            console.log("获取掉落配置", dropDataJson);
            this.dropDataMap = new Map();
            for (const key in dropDataJson) {
                this.dropDataMap.set(key, dropDataJson[key]);
            }
        } catch (e) {
            console.warn("掉落配置加载初始化失败", e);
            this.dropDataMap = new Map();
        }
    }
    public static playMusic(name: string, volume: number = 1) {
        const s = this.sounds[name];
        if (!s) return;
        try {
            // 尝试以循环方式播放背景音乐；某些 Excalibur 版本可能不直接暴露 loop 属性
            // @ts-ignore
            s.loop = true;
            s.play(volume);
        } catch (e) {
            try {
                s.play(volume);
            } catch (err) {
                console.warn('播放背景音乐失败', err);
            }
        }
    }
    public static playSound(name: string, volume: number = 1) {
        const s = this.sounds[name];
        if (!s) return;
        try {
            s.play(volume);
        } catch (e) {
            console.warn(`播放音效 ${name} 失败`, e);
        }
    }
};