import { Scene } from 'phaser';

import { EventBus } from '../EventBus';
import { resetRunState } from '../GoldenHarvestState';

export class TitleScene extends Scene
{
    private isStarting = false;

    constructor ()
    {
        super('TitleScene');
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0x18351f);

        this.add.rectangle(512, 384, 1024, 768, 0x2d572c, 0.88);
        this.add.rectangle(512, 600, 1024, 240, 0x6e4d2d, 0.52);
        this.add.rectangle(512, 384, 820, 520, 0x112114, 0.78).setStrokeStyle(3, 0xf0cf67, 1);

        for (let index = 0; index < 7; index++)
        {
            this.add.rectangle(190 + (index * 108), 572, 22, 150, 0xe0b53f, 0.85).setAngle(index % 2 === 0 ? -10 : 10);
            this.add.rectangle(200 + (index * 108), 570, 12, 124, 0xf7dd73, 0.95).setAngle(index % 2 === 0 ? 8 : -8);
        }

        this.add.text(512, 180, 'Golden Harvest', {
            fontFamily: 'Arial Black',
            fontSize: 64,
            color: '#fff6d5',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        this.add.text(512, 262, '⏱ 20s   ➜ auto-scroll   ↕ glide   🛒 shop', {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#f8f1db'
        }).setOrigin(0.5);

        this.add.text(512, 350, 'Coupe le plus de ble possible en suivant la meilleure ligne.\nMoins de texte, plus de run.', {
            fontFamily: 'Arial',
            fontSize: 28,
            color: '#fff0bf',
            align: 'center',
            lineSpacing: 10
        }).setOrigin(0.5);

        this.add.text(512, 470, 'Commandes: Haut / Bas, Z / W et S', {
            fontFamily: 'Arial Black',
            fontSize: 26,
            color: '#f7d354'
        }).setOrigin(0.5);

        const startText = this.add.text(512, 560, 'Appuie sur ENTREE, ESPACE ou clique pour commencer', {
            fontFamily: 'Arial Black',
            fontSize: 28,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.tweens.add({
            targets: startText,
            alpha: 0.35,
            yoyo: true,
            repeat: -1,
            duration: 700
        });

        this.input.keyboard?.once('keydown-ENTER', this.startRun, this);
        this.input.keyboard?.once('keydown-SPACE', this.startRun, this);
        this.input.once('pointerdown', this.startRun, this);

        EventBus.emit('current-scene-ready', this);
    }

    private startRun ()
    {
        if (this.isStarting)
        {
            return;
        }

        this.isStarting = true;
        resetRunState();
        this.scene.start('HarvestScene');
    }
}
