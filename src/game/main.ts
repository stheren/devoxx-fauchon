import { Boot } from './scenes/Boot';
import { HarvestScene } from './scenes/HarvestScene';
import { ShopScene } from './scenes/ShopScene';
import { TitleScene } from './scenes/TitleScene';
import { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scene: [
        Boot,
        Preloader,
        TitleScene,
        HarvestScene,
        ShopScene
    ]
};

const StartGame = (parent: string) => {

    return new Game({ ...config, parent });

}

export default StartGame;
