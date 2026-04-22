import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    preload ()
    {
        this.load.setPath('assets');
        this.load.image('wheat-stage-5', 'Wheat_Stage_5.png');
    }

    create ()
    {
        this.cameras.main.setBackgroundColor(0x16351f);

        this.add.rectangle(512, 384, 1024, 768, 0x274f30, 0.65);
        this.add.rectangle(512, 384, 460, 220, 0x102313, 0.92).setStrokeStyle(3, 0xf0cf67, 1);

        this.add.text(512, 320, 'Preparation du champ', {
            fontFamily: 'Arial Black',
            fontSize: 34,
            color: '#fff5d1',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        this.add.text(512, 362, 'Affutage de la faux et chargement de la boutique...', {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#f4f0df'
        }).setOrigin(0.5);

        const outline = this.add.rectangle(512, 420, 320, 22).setStrokeStyle(2, 0xffffff, 0.7);
        const bar = this.add.rectangle(354, 420, 6, 16, 0xf7d354).setOrigin(0, 0.5);

        this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 500,
            onUpdate: (tween) =>
            {
                const progress = tween.getValue();
                bar.width = 6 + (308 * progress);
                outline.rotation = progress * 0.01;
            },
            onComplete: () =>
            {
                this.scene.start('TitleScene');
            }
        });
    }
}
