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
    public static music: ex.Sound | undefined;
    public static sounds: Record<string, ex.Sound> = {};
    public static async init() {
        const imagePathResource = new ex.Resource<ImageDataMap>("./data/images-paht-map.json", "json");
        this.imageDataMap = new Map();
        //加载json
        const imageDataJson = await imagePathResource.load();
        console.log("获取图片路径", imageDataJson);
        //将json数据添加到属性
        for (const key in imageDataJson) {
            this.imageMap[key] = new ex.ImageSource(imageDataJson[key].path);
            this.imageDataMap.set(key, imageDataJson[key]);
        }

        //加载地图
        const mapList = [
            { name: "village", path: "./maps/village/village.tmx" },
            { name: "interior", path: "./maps/village/interior.tmx" }
        ]

        for (const map of mapList) {
            let tileMap = new TiledResource(map.path, {
                useTilemapCameraStrategy: true
            });
            this.tileMapMap[map.name] = tileMap;
        }

        // 加载音频资源（public/music 下只有一首背景音乐，public/sounds 下为若干音效）
        try {
            this.music = new ex.Sound("./music/time_for_adventure.mp3");
            this.sounds = {
                coin: new ex.Sound("./sounds/coin.wav"),
                explosion: new ex.Sound("./sounds/explosion.wav"),
                hurt: new ex.Sound("./sounds/hurt.wav"),
                jump: new ex.Sound("./sounds/jump.wav"),
                power_up: new ex.Sound("./sounds/power_up.wav"),
                tap: new ex.Sound("./sounds/tap.wav")
            };
        } catch (e) {
            console.warn("音频资源加载初始化失败", e);
        }

    }
    public static playMusic() {
        if (!this.music) return;
        try {
            // 尝试以循环方式播放背景音乐；某些 Excalibur 版本可能不直接暴露 loop 属性
            // @ts-ignore
            this.music.loop = true;
            this.music.play();
        } catch (e) {
            try {
                this.music.play();
            } catch (err) {
                console.warn('播放背景音乐失败', err);
            }
        }
    }
    public static playSound(name: string) {
        const s = this.sounds[name];
        if (!s) return;
        try {
            s.play();
        } catch (e) {
            console.warn(`播放音效 ${name} 失败`, e);
        }
    }
};