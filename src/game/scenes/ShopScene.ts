import * as Phaser from 'phaser';
import { Scene } from 'phaser';

import { EventBus } from '../EventBus';
import { getRunState, getUpgradeDefinitions, getUpgradePrice, purchaseUpgrade, UpgradeId } from '../GoldenHarvestState';

export class ShopScene extends Scene
{
    private infoText!: Phaser.GameObjects.Text;
    private walletText!: Phaser.GameObjects.Text;
    private cardObjects: Phaser.GameObjects.GameObject[] = [];

    constructor ()
    {
        super('ShopScene');
    }

    create ()
    {
        const runState = getRunState();

        if (runState.lastSummary === null)
        {
            this.scene.start('TitleScene');
            return;
        }

        this.cameras.main.setBackgroundColor(0x1a2314);
        this.add.rectangle(512, 384, 1024, 768, 0x29351e, 1);
        this.add.rectangle(512, 384, 864, 620, 0x121910, 0.92).setStrokeStyle(3, 0xf0cf67, 1);

        this.add.text(512, 122, `Jour ${runState.lastSummary.day} termine`, {
            fontFamily: 'Arial Black',
            fontSize: 52,
            color: '#fff6d5',
            stroke: '#000000',
            strokeThickness: 7
        }).setOrigin(0.5);

        this.infoText = this.add.text(512, 206, '', {
            fontFamily: 'Arial',
            fontSize: 24,
            color: '#f8f1db',
            align: 'center',
            lineSpacing: 8
        }).setOrigin(0.5);

        this.walletText = this.add.text(512, 278, '', {
            fontFamily: 'Arial Black',
            fontSize: 28,
            color: '#f7d354',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5);

        this.input.keyboard?.on('keydown', this.handleKeyDown, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        {
            this.input.keyboard?.off('keydown', this.handleKeyDown, this);
        });

        this.refreshView();
        EventBus.emit('current-scene-ready', this);
    }

    private handleKeyDown (event: KeyboardEvent)
    {
        const digitMatch = event.code.match(/^Digit([1-6])$/);

        if (digitMatch)
        {
            const upgradeIndex = Number(digitMatch[1]) - 1;
            const upgrade = getUpgradeDefinitions()[upgradeIndex];

            if (upgrade)
            {
                this.tryBuyUpgrade(upgrade.id);
            }

            return;
        }

        switch (event.code)
        {
            case 'Enter':
            case 'Space':
                this.scene.start('HarvestScene');
                break;
            case 'Escape':
                this.scene.start('TitleScene');
                break;
            default:
                break;
        }
    }

    private tryBuyUpgrade (upgradeId: UpgradeId)
    {
        if (!purchaseUpgrade(upgradeId))
        {
            this.flashWallet();
            return;
        }

        this.refreshView();
    }

    private refreshView ()
    {
        const runState = getRunState();

        if (runState.lastSummary === null)
        {
            return;
        }

        this.infoText.setText(
            `✳ ${runState.lastSummary.harvested}    ¤ ${runState.lastSummary.earned}    ✦ ${runState.lastSummary.bestCombo}    ○ ${runState.lastSummary.remainingWheat}`
        );
        this.walletText.setText(`¤ ${runState.wallet}`);

        this.cardObjects.forEach((object) => object.destroy());
        this.cardObjects = [];

        getUpgradeDefinitions().forEach((upgrade, index) =>
        {
            const level = runState.upgrades[upgrade.id];
            const price = getUpgradePrice(upgrade.id);
            const isMaxed = level >= upgrade.maxLevel;
            const canBuy = !isMaxed && runState.wallet >= price;
            const column = index % 2;
            const row = Math.floor(index / 2);
            const x = column === 0 ? 316 : 708;
            const y = 376 + (row * 112);
            const backgroundColor = canBuy ? 0x24452d : 0x342b22;
            const borderColor = isMaxed ? 0x8dc26d : (canBuy ? 0xf0cf67 : 0x8d7155);
            const previewLevel = level + (isMaxed ? 0 : 1);

            const background = this.add.rectangle(x, y, 344, 96, backgroundColor, 0.98).setStrokeStyle(2, borderColor, 1);
            const hotkey = this.add.text(x - 150, y - 30, `${index + 1}`, {
                fontFamily: 'Arial Black',
                fontSize: 24,
                color: canBuy ? '#f7d354' : '#b79474'
            }).setOrigin(0, 0.5);
            const icon = this.add.text(x - 118, y - 30, upgrade.icon, {
                fontFamily: 'Arial Black',
                fontSize: 24,
                color: '#fff6d5'
            }).setOrigin(0, 0.5);
            const title = this.add.text(x - 82, y - 30, `${upgrade.label}`, {
                fontFamily: 'Arial Black',
                fontSize: 20,
                color: '#fff6d5'
            }).setOrigin(0, 0.5);
            const levelLabel = this.add.text(x + 150, y - 30, `${level}/${upgrade.maxLevel}`, {
                fontFamily: 'Arial Black',
                fontSize: 18,
                color: '#ffe59c'
            }).setOrigin(1, 0.5);
            const description = this.add.text(x - 150, y - 2, upgrade.description, {
                fontFamily: 'Arial',
                fontSize: 15,
                color: '#f8f1db'
            }).setOrigin(0, 0.5);
            const effect = this.add.text(x - 150, y + 24, upgrade.effectText(previewLevel), {
                fontFamily: 'Arial Black',
                fontSize: 15,
                color: '#d6efab'
            }).setOrigin(0, 0.5);
            const priceLabel = this.add.text(x + 150, y + 22, isMaxed ? 'MAX' : `${price} or`, {
                fontFamily: 'Arial Black',
                fontSize: 24,
                color: isMaxed ? '#9fe06f' : (canBuy ? '#f7d354' : '#caa57f')
            }).setOrigin(1, 0.5);

            this.cardObjects.push(background, hotkey, icon, title, levelLabel, description, effect, priceLabel);
        });

        const footer = this.add.text(512, 722, `1-6 acheter  |  ENTREE lancer le run ${runState.day}  |  ECHAP titre`, {
            fontFamily: 'Arial',
            fontSize: 20,
            color: '#fff2bf'
        }).setOrigin(0.5);

        this.cardObjects.push(footer);
    }

    private flashWallet ()
    {
        this.tweens.add({
            targets: this.walletText,
            alpha: 0.28,
            yoyo: true,
            duration: 120,
            repeat: 1
        });
    }
}
