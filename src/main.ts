import { Game, Scale, Types } from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

const config: Types.Core.GameConfig = {
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#2d2d2d',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
            fixedStep: false
        }
    },
    render: {
        pixelArt: true,
        roundPixels: false
    },
    scale: {
        mode: Scale.RESIZE,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [BootScene, GameScene]
};

// 启动游戏
new Game(config);
