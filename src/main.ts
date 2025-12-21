// main.ts
import * as ex from 'excalibur';
import { TestMap } from './maps/test-map';
import { Asset } from './asset';

const game = new ex.Engine({
    width: 800,
    height: 600,
    backgroundColor: ex.Color.fromHex("#000000ff"),
    pixelArt: true,
    pixelRatio: 2,
    displayMode: ex.DisplayMode.FitScreen,
    //注册场景
    scenes: { TestMpa: TestMap },
});

//初始化资源
await Asset.init();
console.log(Asset.imageMap);
const loader = new ex.Loader(Object.values(Asset.imageMap));
loader.suppressPlayButton = true;
game.start(loader).then(() => {
    game.goToScene('TestMpa');
});