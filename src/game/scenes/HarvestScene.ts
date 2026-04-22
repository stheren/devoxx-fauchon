import * as Phaser from 'phaser';
import { Scene } from 'phaser';

import { EventBus } from '../EventBus';
import { finishDay, formatTime, getPlayerStats, getRunState, registerHarvest, startDay, tickDay } from '../GoldenHarvestState';

interface WheatPatch
{
    x: number;
    y: number;
    sprite: Phaser.GameObjects.Image;
    harvested: boolean;
}

interface MovementKeys
{
    upAzerty: Phaser.Input.Keyboard.Key;
    upQwerty: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
}

interface PatternPoint
{
    offsetX: number;
    offsetY: number;
}

interface BackgroundWheatPatch
{
    sprite: Phaser.GameObjects.Image;
    speedMultiplier: number;
    minY: number;
    maxY: number;
    minScale: number;
    maxScale: number;
    baseTint: number;
    sunsetTint: number;
    baseAlpha: number;
}

const HARVEST_PATTERNS: PatternPoint[][] = [
    [
        { offsetX: 0, offsetY: 0 },
        { offsetX: 44, offsetY: -22 },
        { offsetX: 88, offsetY: 14 },
        { offsetX: 132, offsetY: -8 }
    ],
    [
        { offsetX: 0, offsetY: -62 },
        { offsetX: 38, offsetY: -20 },
        { offsetX: 76, offsetY: 18 },
        { offsetX: 114, offsetY: 60 }
    ],
    [
        { offsetX: 0, offsetY: 52 },
        { offsetX: 40, offsetY: 10 },
        { offsetX: 80, offsetY: -28 },
        { offsetX: 120, offsetY: -66 }
    ],
    [
        { offsetX: 0, offsetY: 0 },
        { offsetX: 34, offsetY: -54 },
        { offsetX: 68, offsetY: 0 },
        { offsetX: 102, offsetY: 54 }
    ],
    [
        { offsetX: 0, offsetY: -22 },
        { offsetX: 24, offsetY: 26 },
        { offsetX: 60, offsetY: -32 },
        { offsetX: 96, offsetY: 20 },
        { offsetX: 132, offsetY: -8 }
    ],
    [
        { offsetX: 0, offsetY: -80 },
        { offsetX: 0, offsetY: 0 },
        { offsetX: 0, offsetY: 80 },
        { offsetX: 42, offsetY: -40 },
        { offsetX: 42, offsetY: 40 }
    ]
];

export class HarvestScene extends Scene
{
    private readonly playArea = new Phaser.Geom.Rectangle(128, 126, 792, 508);
    private readonly playerX = 226;
    private readonly spawnX = 1108;
    private readonly despawnX = -120;

    private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
    private movementKeys!: MovementKeys;
    private player!: Phaser.GameObjects.Container;
    private playerShadow!: Phaser.GameObjects.Ellipse;
    private playerTorso!: Phaser.GameObjects.Rectangle;
    private playerLegFront!: Phaser.GameObjects.Rectangle;
    private playerLegBack!: Phaser.GameObjects.Rectangle;
    private playerArmFront!: Phaser.GameObjects.Rectangle;
    private playerArmBack!: Phaser.GameObjects.Rectangle;
    private playerScythe!: Phaser.GameObjects.Container;
    private dayText!: Phaser.GameObjects.Text;
    private timeText!: Phaser.GameObjects.Text;
    private moneyText!: Phaser.GameObjects.Text;
    private harvestText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private goalText!: Phaser.GameObjects.Text;
    private runHintText!: Phaser.GameObjects.Text;
    private skyTop!: Phaser.GameObjects.Rectangle;
    private skyHorizon!: Phaser.GameObjects.Rectangle;
    private laneField!: Phaser.GameObjects.Polygon;
    private dirtBase!: Phaser.GameObjects.Polygon;
    private dirtHighlight!: Phaser.GameObjects.Polygon;
    private sun!: Phaser.GameObjects.Arc;
    private sunGlow!: Phaser.GameObjects.Ellipse;
    private backgroundWheat: BackgroundWheatPatch[] = [];
    private wheatPatches: WheatPatch[] = [];
    private harvestCooldownMs = 0;
    private spawnCooldownMs = 0;
    private missedWheat = 0;
    private anchorY = 380;
    private playerY = 0;
    private walkCycle = 0;
    private isSwinging = false;
    private finished = false;

    constructor ()
    {
        super('HarvestScene');
    }

    create ()
    {
        startDay();

        this.backgroundWheat = [];
        this.wheatPatches = [];
        this.harvestCooldownMs = 0;
        this.spawnCooldownMs = 260;
        this.missedWheat = 0;
        this.anchorY = this.playArea.centerY;
        this.finished = false;

        this.cameras.main.setBackgroundColor(0x6aabf2);
        this.buildEnvironment();
        this.buildPlayer();
        this.buildHud();
        this.configureInput();
        this.refreshHud();

        EventBus.emit('current-scene-ready', this);
    }

    update (time: number, delta: number)
    {
        if (this.finished)
        {
            return;
        }

        const remainingTime = tickDay(delta);

        const isMoving = this.handleMovement(delta);
        this.updatePlayerAnimation(delta, isMoving);
        this.scrollBackground(delta);
        this.scrollWheat(delta);

        this.spawnCooldownMs = Math.max(0, this.spawnCooldownMs - delta);

        if (this.spawnCooldownMs === 0)
        {
            this.spawnPattern();
            this.spawnCooldownMs = this.getNextSpawnDelay();
        }

        this.harvestCooldownMs = Math.max(0, this.harvestCooldownMs - delta);

        if (this.harvestCooldownMs === 0)
        {
            this.harvestAroundPlayer(time);
            this.harvestCooldownMs = 90;
        }

        this.cleanupWheat();

        if (remainingTime === 0)
        {
            this.endDay();
            return;
        }

        this.refreshHud();
    }

    private buildEnvironment ()
    {
        this.skyTop = this.add.rectangle(512, 92, 1024, 184, 0x86c8ff, 1);
        this.skyHorizon = this.add.rectangle(512, 226, 1024, 148, 0xc8e6ff, 1);
        this.sunGlow = this.add.ellipse(212, 134, 150, 150, 0xffe7a3, 0.22);
        this.sun = this.add.circle(212, 134, 42, 0xfff1b0, 1).setStrokeStyle(4, 0xfff6cf, 0.7);

        this.laneField = this.add.polygon(0, 0, [
            0, 768,
            0, 418,
            324, 286,
            1024, 246,
            1024, 768
        ], 0x699f48, 0.95).setOrigin(0, 0).setStrokeStyle(4, 0x223619, 1);

        this.dirtBase = this.add.polygon(0, 0, [
            0, 768,
            0, 580,
            176, 484,
            410, 352,
            1024, 312,
            1024, 768
        ], 0x7d5530, 0.2).setOrigin(0, 0);

        this.dirtHighlight = this.add.polygon(0, 0, [
            0, 768,
            0, 662,
            132, 604,
            330, 484,
            612, 344,
            1024, 308,
            1024, 768
        ], 0xc89543, 0.18).setOrigin(0, 0);

        this.seedBackgroundWheat();

        this.add.text(136, 90, 'Run de moisson - champ vivant', {
            fontFamily: 'Arial Black',
            fontSize: 18,
            color: '#fff4cb'
        }).setOrigin(0, 0.5);

        this.updateAtmosphere(0);
    }

    private buildPlayer ()
    {
        const startY = this.playArea.centerY;
        const skinColor = 0xf2d59c;
        const clothColor = 0x6b8449;
        const clothDarkColor = 0x4d6134;
        const leatherColor = 0x7c5a30;

        this.playerY = startY;
        this.playerShadow = this.add.ellipse(this.playerX, startY + 30, 40, 16, 0x111111, 0.35);

        const legBack = this.add.rectangle(-6, 15, 9, 28, 0x5d4124).setOrigin(0.5, 0);
        const legFront = this.add.rectangle(8, 15, 10, 30, 0x674826).setOrigin(0.5, 0);
        const bootBack = this.add.rectangle(-6, 46, 16, 7, 0x2d1a11);
        const bootFront = this.add.rectangle(8, 48, 16, 7, 0x2d1a11);
        const armBack = this.add.rectangle(-16, -8, 8, 28, skinColor).setOrigin(0.5, 0);
        const torso = this.add.rectangle(0, -2, 28, 36, clothColor).setStrokeStyle(2, clothDarkColor, 1);
        const apron = this.add.rectangle(0, 4, 18, 22, 0xd9b85d).setStrokeStyle(2, 0x8c6926, 1);
        const bandana = this.add.rectangle(0, -11, 22, 6, 0xd66f2d);
        const head = this.add.circle(0, -24, 12, skinColor).setStrokeStyle(2, 0x6b4524, 1);
        const beard = this.add.ellipse(2, -16, 16, 10, 0x8d5d2d, 0.95);
        const eye = this.add.circle(5, -26, 1.6, 0x2b180c);
        const hatBrim = this.add.rectangle(0, -37, 34, 6, leatherColor).setStrokeStyle(2, 0x3f240d, 1);
        const hatTop = this.add.rectangle(0, -45, 22, 12, 0x8d5f27).setStrokeStyle(2, 0x3f240d, 1);
        const armFront = this.add.rectangle(15, -8, 8, 30, skinColor).setOrigin(0.5, 0);

        const scytheHandle = this.add.rectangle(14, 6, 5, 58, 0x8a6230).setAngle(22).setStrokeStyle(1, 0x5d3a18, 1);
        const scytheGrip = this.add.rectangle(8, 18, 10, 6, 0x54351b).setAngle(22);
        const scytheBlade = this.add.ellipse(24, -18, 18, 38, 0xdfe4e8).setAngle(-28).setStrokeStyle(2, 0x738089, 1);
        this.playerScythe = this.add.container(17, -1, [scytheHandle, scytheGrip, scytheBlade]);
        this.playerScythe.setAngle(22);

        this.playerLegBack = legBack;
        this.playerLegFront = legFront;
        this.playerArmBack = armBack;
        this.playerArmFront = armFront;
        this.playerTorso = torso;

        this.player = this.add.container(this.playerX, startY, [
            legBack,
            bootBack,
            armBack,
            torso,
            apron,
            bandana,
            head,
            beard,
            eye,
            hatBrim,
            hatTop,
            legFront,
            bootFront,
            armFront,
            this.playerScythe
        ]);
    }

    private buildHud ()
    {
        const labelStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontFamily: 'Arial Black',
            fontSize: 22,
            color: '#fff5d1',
            stroke: '#000000',
            strokeThickness: 5
        };

        this.add.rectangle(146, 102, 234, 158, 0x09110c, 0.42).setStrokeStyle(2, 0xf0cf67, 0.18);
        this.add.rectangle(894, 78, 214, 110, 0x09110c, 0.42).setStrokeStyle(2, 0xf0cf67, 0.18);
        this.add.rectangle(190, 714, 308, 70, 0x09110c, 0.42).setStrokeStyle(2, 0xf0cf67, 0.18);
        this.add.rectangle(834, 714, 308, 70, 0x09110c, 0.42).setStrokeStyle(2, 0xf0cf67, 0.18);
        this.add.rectangle(512, 714, 220, 56, 0x09110c, 0.42).setStrokeStyle(2, 0xf0cf67, 0.18);

        this.dayText = this.add.text(44, 34, '', labelStyle);
        this.timeText = this.add.text(44, 78, '', labelStyle);
        this.moneyText = this.add.text(978, 32, '', labelStyle).setOrigin(1, 0);
        this.runHintText = this.add.text(978, 74, '', {
            fontFamily: 'Arial Black',
            fontSize: 22,
            color: '#fff0bf',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(1, 0);
        this.harvestText = this.add.text(48, 696, '', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#fff5d1',
            stroke: '#000000',
            strokeThickness: 5
        });
        this.comboText = this.add.text(976, 696, '', {
            fontFamily: 'Arial Black',
            fontSize: 24,
            color: '#fff5d1',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(1, 0);
        this.goalText = this.add.text(512, 701, '', {
            fontFamily: 'Arial Black',
            fontSize: 20,
            color: '#fff2bf'
        }).setOrigin(0.5, 0);
    }

    private configureInput ()
    {
        this.cursors = this.input.keyboard?.createCursorKeys();
        this.movementKeys = {
            upAzerty: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
            upQwerty: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S)
        };
    }

    private handleMovement (delta: number)
    {
        const up = Boolean(this.cursors?.up.isDown || this.movementKeys.upAzerty.isDown || this.movementKeys.upQwerty.isDown);
        const down = Boolean(this.cursors?.down.isDown || this.movementKeys.down.isDown);

        if (up === down)
        {
            return false;
        }

        const direction = down ? 1 : -1;
        const distance = (getPlayerStats().moveSpeed * delta) / 1000;
        const nextY = Phaser.Math.Clamp(this.playerY + (direction * distance), this.playArea.top + 16, this.playArea.bottom - 16);

        this.setPlayerPosition(nextY);
        return true;
    }

    private setPlayerPosition (y: number)
    {
        this.playerY = y;
        this.player.setPosition(this.playerX, y);
        this.playerShadow.setY(y + 24);
    }

    private updatePlayerAnimation (delta: number, isMoving: boolean)
    {
        this.walkCycle += delta * (isMoving ? 0.018 : 0.011);

        const swing = Math.sin(this.walkCycle);
        const secondary = Math.cos(this.walkCycle);
        const motionFactor = isMoving ? 1 : 0.55;

        this.playerLegFront.setAngle(18 + (swing * 24 * motionFactor));
        this.playerLegBack.setAngle(-12 - (swing * 22 * motionFactor));
        this.playerArmBack.setAngle(-18 - (swing * 16 * motionFactor));
        this.playerTorso.setAngle(secondary * 2.2 * motionFactor);

        if (!this.isSwinging)
        {
            this.playerArmFront.setAngle(22 + (secondary * 12 * motionFactor));
            this.playerScythe.setAngle(24 + (secondary * 9 * motionFactor));
        }

        this.player.setPosition(this.playerX + (secondary * 1.3), this.playerY + Math.abs(swing) * 1.6);
        this.playerShadow.setScale(1 - (Math.abs(swing) * 0.04), 1);
    }

    private scrollBackground (delta: number)
    {
        const drift = (this.getScrollSpeed() * delta) / 1000;
        const activeDay = getRunState().activeDay;

        if (activeDay)
        {
            const progress = 1 - (activeDay.remainingMs / activeDay.durationMs);
            this.updateAtmosphere(progress);
        }

        this.backgroundWheat.forEach((patch) =>
        {
            patch.sprite.x -= drift * patch.speedMultiplier;

            if (patch.sprite.x < -90)
            {
                this.respawnBackgroundWheat(patch, 1110 + Phaser.Math.Between(0, 220));
            }
        });
    }

    private updateAtmosphere (progress: number)
    {
        const skyTopColor = this.mixColor(0x86c8ff, 0xe88e5c, progress);
        const skyHorizonColor = this.mixColor(0xc8e6ff, 0xf4c57f, progress);
        const laneColor = this.mixColor(0x7c9f43, 0x81684a, progress);
        const dirtColor = this.mixColor(0x5d7d31, 0x5f4a34, progress);
        const highlightColor = this.mixColor(0xd3a34c, 0xde8a46, progress);

        this.skyTop.setFillStyle(skyTopColor, 1);
        this.skyHorizon.setFillStyle(skyHorizonColor, 1);
        this.laneField.setFillStyle(laneColor, 0.94);
        this.dirtBase.setFillStyle(dirtColor, 0.2);
        this.dirtHighlight.setFillStyle(highlightColor, 0.18);

        const sunX = 180 + (progress * 620);
        const sunY = 126 + (progress * 126) - (Math.sin(progress * Math.PI) * 38);
        const sunColor = this.mixColor(0xfff2b3, 0xffa85c, progress);

        this.sun.setPosition(sunX, sunY).setFillStyle(sunColor, 1);
        this.sunGlow.setPosition(sunX, sunY)
            .setFillStyle(this.mixColor(0xfff0ba, 0xffae64, progress), 0.24 - (progress * 0.06));

        this.backgroundWheat.forEach((patch) =>
        {
            patch.sprite.setTint(this.mixColor(patch.baseTint, patch.sunsetTint, progress));
            patch.sprite.setAlpha(patch.baseAlpha - (progress * 0.06));
        });
    }

    private mixColor (startColor: number, endColor: number, progress: number)
    {
        const start = Phaser.Display.Color.ValueToColor(startColor);
        const end = Phaser.Display.Color.ValueToColor(endColor);
        const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(start, end, 100, progress * 100);

        return Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b);
    }

    private seedBackgroundWheat ()
    {
        this.createBackgroundWheatBand(28, 0.16, 294, 408, 0.32, 0.42, 0xcaa944, 0xc38a4d, 0.26);
        this.createBackgroundWheatBand(34, 0.28, 382, 522, 0.46, 0.6, 0xd8b349, 0xcd8f45, 0.42);
        this.createBackgroundWheatBand(40, 0.42, 488, 644, 0.62, 0.82, 0xe7c24e, 0xd89446, 0.62);
    }

    private createBackgroundWheatBand (
        count: number,
        speedMultiplier: number,
        minY: number,
        maxY: number,
        minScale: number,
        maxScale: number,
        baseTint: number,
        sunsetTint: number,
        baseAlpha: number
    )
    {
        for (let index = 0; index < count; index++)
        {
            const sprite = this.add.image(0, 0, 'wheat-stage-5').setOrigin(0.5, 1);
            const patch: BackgroundWheatPatch = {
                sprite,
                speedMultiplier,
                minY,
                maxY,
                minScale,
                maxScale,
                baseTint,
                sunsetTint,
                baseAlpha
            };

            this.respawnBackgroundWheat(patch, Phaser.Math.Between(-60, 1120));
            this.backgroundWheat.push(patch);
        }
    }

    private respawnBackgroundWheat (patch: BackgroundWheatPatch, x: number)
    {
        const y = Phaser.Math.Between(patch.minY, patch.maxY);
        const scale = Phaser.Math.FloatBetween(patch.minScale, patch.maxScale);

        patch.sprite.setPosition(x, y);
        patch.sprite.setScale(scale);
        patch.sprite.setAngle(Phaser.Math.Between(-7, 7));
        patch.sprite.setTint(patch.baseTint);
        patch.sprite.setAlpha(patch.baseAlpha);
    }

    private scrollWheat (delta: number)
    {
        const drift = (this.getScrollSpeed() * delta) / 1000;

        this.wheatPatches.forEach((patch) =>
        {
            patch.x -= drift;
            patch.sprite.setPosition(patch.x, patch.y);
        });
    }

    private spawnPattern ()
    {
        const pattern = Phaser.Utils.Array.GetRandom(HARVEST_PATTERNS);
        const driftRange = getPlayerStats().waveDriftRange;
        const drift = Phaser.Math.Between(-driftRange, driftRange);

        this.anchorY = Phaser.Math.Clamp(this.anchorY + drift, this.playArea.top + 86, this.playArea.bottom - 86);

        pattern.forEach(({ offsetX, offsetY }) =>
        {
            const x = this.spawnX + offsetX;
            const y = Phaser.Math.Clamp(this.anchorY + offsetY, this.playArea.top + 28, this.playArea.bottom - 28);
            const scale = Phaser.Math.FloatBetween(0.48, 0.6);
            const sprite = this.add.image(x, y, 'wheat-stage-5')
                .setOrigin(0.5, 1)
                .setScale(scale)
                .setAngle(Phaser.Math.Between(-7, 7));

            this.wheatPatches.push({
                x,
                y,
                sprite,
                harvested: false
            });
        });
    }

    private getNextSpawnDelay ()
    {
        return Phaser.Math.Between(220, 360);
    }

    private harvestAroundPlayer (time: number)
    {
        const { harvestRadius } = getPlayerStats();
        const harvestedNow = this.wheatPatches.filter((patch) =>
        {
            if (patch.harvested)
            {
                return false;
            }

            return Phaser.Math.Distance.Between(this.playerX, this.playerY, patch.x, patch.y) <= harvestRadius;
        });

        if (harvestedNow.length === 0)
        {
            return;
        }

        harvestedNow.forEach((patch) =>
        {
            patch.harvested = true;
            patch.sprite.setTint(0x8b6a3d).setAlpha(0.42);

            this.tweens.add({
                targets: patch.sprite,
                angle: patch.sprite.angle + Phaser.Math.Between(-25, 25),
                alpha: 0.24,
                scaleY: patch.sprite.scaleY * 0.4,
                duration: 140
            });
        });

        const resolution = registerHarvest(harvestedNow.length, time);
        this.playHarvestSwing();
        this.spawnHarvestFeedback(resolution.reward, resolution.combo, resolution.comboBonus, resolution.bigCutBonus, harvestRadius);
    }

    private playHarvestSwing ()
    {
        if (this.isSwinging)
        {
            return;
        }

        this.isSwinging = true;

        this.tweens.add({
            targets: this.playerArmFront,
            angle: -58,
            duration: 90,
            ease: 'Cubic.Out',
            yoyo: true,
            hold: 16,
            onComplete: () =>
            {
                this.isSwinging = false;
            }
        });

        this.tweens.add({
            targets: this.playerScythe,
            angle: -48,
            duration: 90,
            ease: 'Cubic.Out',
            yoyo: true,
            hold: 16
        });
    }

    private cleanupWheat ()
    {
        const survivors: WheatPatch[] = [];

        this.wheatPatches.forEach((patch) =>
        {
            if (patch.x > this.despawnX)
            {
                survivors.push(patch);
                return;
            }

            if (!patch.harvested)
            {
                this.missedWheat += 1;
            }

            patch.sprite.destroy();
        });

        this.wheatPatches = survivors;
    }

    private spawnHarvestFeedback (reward: number, combo: number, comboBonus: number, bigCutBonus: number, harvestRadius: number)
    {
        const wave = this.add.ellipse(this.playerX + 12, this.playerY, harvestRadius * 2.1, harvestRadius * 2.1, 0xf0cf67, 0.16)
            .setStrokeStyle(2, 0xfff2c0, 0.45);

        const rewardText = this.add.text(this.playerX + 34, this.playerY - 50, `+${reward}`, {
            fontFamily: 'Arial Black',
            fontSize: 22,
            color: '#fff7c7',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5);

        const comboParts = [`Combo x${combo}`];

        if (comboBonus > 0)
        {
            comboParts.push(`bonus +${comboBonus}`);
        }

        if (bigCutBonus > 0)
        {
            comboParts.push(`grand +${bigCutBonus}`);
        }

        const comboLabel = comboParts.join('  ');
        const comboText = this.add.text(this.playerX + 58, this.playerY - 78, comboLabel, {
            fontFamily: 'Arial',
            fontSize: 18,
            color: '#f7d354',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.tweens.add({
            targets: [rewardText, comboText],
            y: '-=22',
            alpha: 0,
            duration: 420,
            onComplete: () =>
            {
                rewardText.destroy();
                comboText.destroy();
            }
        });

        this.tweens.add({
            targets: wave,
            alpha: 0,
            scaleX: 1.22,
            scaleY: 1.22,
            duration: 220,
            onComplete: () =>
            {
                wave.destroy();
            }
        });
    }

    private refreshHud ()
    {
        const runState = getRunState();
        const activeDay = runState.activeDay;

        if (!activeDay)
        {
            return;
        }

        this.dayText.setText(`◈  J${runState.day}`);
        this.timeText.setText(`⏱  ${formatTime(activeDay.remainingMs)}`);
        this.moneyText.setText(`¤  ${runState.wallet}`);
        this.harvestText.setText(`✳ ${activeDay.harvested}   ○ ${this.missedWheat}`);
        this.comboText.setText(`✦ ${activeDay.combo}   ◎ ${activeDay.bestCombo}`);
        this.runHintText.setText(`➜  ${Math.round(this.getScrollSpeed())}   ≈ ${getPlayerStats().waveDriftRange}`);
        this.goalText.setText(
            `↕ ${getPlayerStats().moveSpeed}   ✂ ${getPlayerStats().harvestRadius}   ¤ x${getPlayerStats().yieldPerWheat}   ✦ +${getPlayerStats().bigCutBonus}`
        );
    }

    private getRemainingWheatCount ()
    {
        return this.missedWheat + this.wheatPatches.filter((patch) => !patch.harvested).length;
    }

    private getScrollSpeed ()
    {
        const baseSpeed = 292 + (Math.min(getRunState().day - 1, 6) * 10);

        return baseSpeed * getPlayerStats().scrollMultiplier;
    }

    private endDay ()
    {
        if (this.finished)
        {
            return;
        }

        this.finished = true;
        finishDay(this.getRemainingWheatCount());

        const banner = this.add.text(512, 384, 'Fin de run', {
            fontFamily: 'Arial Black',
            fontSize: 46,
            color: '#fff5d1',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(30);

        this.tweens.add({
            targets: banner,
            scale: 1.06,
            yoyo: true,
            duration: 180
        });

        this.time.delayedCall(450, () =>
        {
            this.scene.start('ShopScene');
        });
    }
}
