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
    }
}

export class Asset {
    public static imageMap: Record<string, ex.ImageSource> = {};
    public static imageDataMap: Map<string, ImageData>;
    public static tileMapMap: Record<string, TiledResource> = {};
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
            { name: "village", path: "./map/village/village.tmx" },
            { name: "interior", path: "./map/village/interior.tmx" }
        ]

        for (const map of mapList) {
            let tileMap = new TiledResource(map.path, {
                useTilemapCameraStrategy: true
            });
            this.tileMapMap[map.name] = tileMap;
        }

    }
};