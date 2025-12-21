import * as ex from 'excalibur';

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
    }
};