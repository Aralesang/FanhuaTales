// main.ts
import * as ex from 'excalibur';
import { TestMap } from './scenes/test-map';
import { Asset } from './asset';
import { Village } from './scenes/village';
import { TiledResource } from '@excaliburjs/plugin-tiled';
import { Interior } from './scenes/interior';
import { TileMapSystem } from './systems/tile-map-system';
import { StateMachinTest } from './test/state-machine-test';

const game = new ex.Engine({
    width: 800,
    height: 600,
    backgroundColor: ex.Color.fromHex("#000000ff"),
    pixelArt: true,
    pixelRatio: 2,
    displayMode: ex.DisplayMode.FitScreen,
    //注册场景
    scenes: {
        "testMap": TestMap,
        "village": Village,
        "interior": Interior
    },
});

//初始化资源
await Asset.init();
const loaderList = [];

loaderList.push(...Object.values(Asset.imageMap));
loaderList.push(...Object.values(Asset.tileMapMap));
// 将音频资源加入加载列表（若存在）
if (Asset.music) {
    loaderList.push(Asset.music);
}
if (Object.keys(Asset.sounds || {}).length > 0) {
    loaderList.push(...Object.values(Asset.sounds));
}

const loader = new ex.Loader(loaderList);

//跳过开始游戏界面
loader.suppressPlayButton = true;
game.start(loader).then(() => {
    // 启动背景音乐（循环播放）
    Asset.playMusic("time_for_adventure", 0.5);
    game.goToScene('village');
});