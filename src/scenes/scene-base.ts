import * as ex from 'excalibur';
import { TileMapSystem } from '../systems/tile-map-system';
import { Asset } from '../asset';

export default class SceneBase extends ex.Scene {
    public sceneName: string;
    constructor(_sceneName: string) {
        super();
        this.sceneName = _sceneName;
    }
    override onInitialize(engine: ex.Engine): void {
        //加载地图数据
        Asset.tileMapMap[this.sceneName]?.addToScene(this);
        //向场景的实体世界注册tileMap系统
        const world = engine.currentScene.world;
        world.add(new TileMapSystem());
    }


}