export type UpgradeId = 'boots' | 'sickle' | 'wagon' | 'pace' | 'furrows' | 'sweep';

export interface UpgradeDefinition
{
    id: UpgradeId;
    icon: string;
    label: string;
    description: string;
    baseCost: number;
    costStep: number;
    costGrowth: number;
    maxLevel: number;
    effectText: (level: number) => string;
}

export interface DayState
{
    durationMs: number;
    remainingMs: number;
    harvested: number;
    earned: number;
    combo: number;
    bestCombo: number;
    lastHarvestAt: number | null;
}

export interface DaySummary
{
    day: number;
    harvested: number;
    earned: number;
    bestCombo: number;
    remainingWheat: number;
}

export interface RunState
{
    day: number;
    wallet: number;
    totalEarned: number;
    totalHarvested: number;
    upgrades: Record<UpgradeId, number>;
    activeDay: DayState | null;
    lastSummary: DaySummary | null;
}

export interface HarvestResolution
{
    reward: number;
    combo: number;
    comboBonus: number;
    bigCutBonus: number;
}

export interface PlayerStats
{
    moveSpeed: number;
    harvestRadius: number;
    yieldPerWheat: number;
    scrollMultiplier: number;
    waveDriftRange: number;
    bigCutThreshold: number;
    bigCutBonus: number;
}

const DAY_DURATION_MS = 20000;
const COMBO_WINDOW_MS = 800;

const INITIAL_UPGRADES: Record<UpgradeId, number> = {
    boots: 0,
    sickle: 0,
    wagon: 0,
    pace: 0,
    furrows: 0,
    sweep: 0
};

const upgradeDefinitions: UpgradeDefinition[] = [
    {
        id: 'boots',
        icon: '↕',
        label: 'Bottes',
        description: 'Monte et descends plus vite pour suivre les vagues de ble.',
        baseCost: 40,
        costStep: 22,
        costGrowth: 12,
        maxLevel: 4,
        effectText: (level) => `Guidage ${260 + (level * 38)}`
    },
    {
        id: 'sickle',
        icon: '✂',
        label: 'Faux large',
        description: 'Elargit la zone de coupe pendant le defilement.',
        baseCost: 48,
        costStep: 24,
        costGrowth: 12,
        maxLevel: 4,
        effectText: (level) => `Coupe ${42 + (level * 9)}px`
    },
    {
        id: 'wagon',
        icon: '¤',
        label: 'Charrette',
        description: 'Chaque gerbe coupee vaut plus de pieces.',
        baseCost: 56,
        costStep: 28,
        costGrowth: 14,
        maxLevel: 4,
        effectText: (level) => `Rendement ${1 + level}/ble`
    },
    {
        id: 'pace',
        icon: '➜',
        label: 'Reperes',
        description: 'Ralentit un peu le defilement pour lire les vagues plus tot.',
        baseCost: 64,
        costStep: 30,
        costGrowth: 16,
        maxLevel: 4,
        effectText: (level) => `Tempo ${Math.round((1 - (level * 0.06)) * 100)}%`
    },
    {
        id: 'furrows',
        icon: '≈',
        label: 'Sillons',
        description: 'Adoucit les gros ecarts verticaux entre deux patterns.',
        baseCost: 60,
        costStep: 28,
        costGrowth: 16,
        maxLevel: 4,
        effectText: (level) => `Derive ${110 - (level * 16)}`
    },
    {
        id: 'sweep',
        icon: '✦',
        label: 'Grand coup',
        description: 'Les coupes de 3 gerbes ou plus rapportent un bonus net.',
        baseCost: 72,
        costStep: 34,
        costGrowth: 18,
        maxLevel: 4,
        effectText: (level) => `Grosse coupe +${level * 2}`
    }
];

const createRunState = (): RunState => ({
    day: 1,
    wallet: 0,
    totalEarned: 0,
    totalHarvested: 0,
    upgrades: { ...INITIAL_UPGRADES },
    activeDay: null,
    lastSummary: null
});

let runState: RunState = createRunState();

const getActiveDay = (): DayState =>
{
    if (runState.activeDay === null)
    {
        throw new Error('Golden Harvest day state is not initialized.');
    }

    return runState.activeDay;
};

export const resetRunState = () =>
{
    runState = createRunState();
};

export const getRunState = () => runState;

export const getUpgradeDefinitions = () => upgradeDefinitions;

export const getUpgradePrice = (upgradeId: UpgradeId) =>
{
    const definition = upgradeDefinitions.find((entry) => entry.id === upgradeId);

    if (!definition)
    {
        throw new Error(`Unknown upgrade id: ${upgradeId}`);
    }

    const level = runState.upgrades[upgradeId];

    return definition.baseCost + (level * definition.costStep) + (level * level * definition.costGrowth);
};

export const getPlayerStats = (): PlayerStats => ({
    moveSpeed: 260 + (runState.upgrades.boots * 38),
    harvestRadius: 42 + (runState.upgrades.sickle * 9),
    yieldPerWheat: 1 + runState.upgrades.wagon,
    scrollMultiplier: 1 - (runState.upgrades.pace * 0.06),
    waveDriftRange: Math.max(46, 110 - (runState.upgrades.furrows * 16)),
    bigCutThreshold: 3,
    bigCutBonus: runState.upgrades.sweep * 2
});

export const startDay = () =>
{
    runState.activeDay = {
        durationMs: DAY_DURATION_MS,
        remainingMs: DAY_DURATION_MS,
        harvested: 0,
        earned: 0,
        combo: 0,
        bestCombo: 0,
        lastHarvestAt: null
    };

    return runState.activeDay;
};

export const tickDay = (delta: number) =>
{
    const day = getActiveDay();

    day.remainingMs = Math.max(0, day.remainingMs - delta);

    return day.remainingMs;
};

export const registerHarvest = (wheatCount: number, timestamp: number): HarvestResolution =>
{
    const day = getActiveDay();
    const comboContinues = day.lastHarvestAt !== null && (timestamp - day.lastHarvestAt) <= COMBO_WINDOW_MS;

    day.combo = comboContinues ? day.combo + wheatCount : wheatCount;
    day.bestCombo = Math.max(day.bestCombo, day.combo);
    day.lastHarvestAt = timestamp;

    const playerStats = getPlayerStats();
    const rewardBase = wheatCount * playerStats.yieldPerWheat;
    const comboBonus = day.combo >= 4 ? Math.floor(day.combo / 4) : 0;
    const bigCutBonus = wheatCount >= playerStats.bigCutThreshold ? playerStats.bigCutBonus : 0;
    const reward = rewardBase + comboBonus + bigCutBonus;

    day.harvested += wheatCount;
    day.earned += reward;
    runState.wallet += reward;
    runState.totalEarned += reward;
    runState.totalHarvested += wheatCount;

    return {
        reward,
        combo: day.combo,
        comboBonus,
        bigCutBonus
    };
};

export const finishDay = (remainingWheat: number) =>
{
    const day = getActiveDay();

    runState.lastSummary = {
        day: runState.day,
        harvested: day.harvested,
        earned: day.earned,
        bestCombo: day.bestCombo,
        remainingWheat
    };

    runState.activeDay = null;
    runState.day += 1;

    return runState.lastSummary;
};

export const purchaseUpgrade = (upgradeId: UpgradeId) =>
{
    const definition = upgradeDefinitions.find((entry) => entry.id === upgradeId);

    if (!definition)
    {
        throw new Error(`Unknown upgrade id: ${upgradeId}`);
    }

    const currentLevel = runState.upgrades[upgradeId];

    if (currentLevel >= definition.maxLevel)
    {
        return false;
    }

    const price = getUpgradePrice(upgradeId);

    if (runState.wallet < price)
    {
        return false;
    }

    runState.wallet -= price;
    runState.upgrades[upgradeId] = currentLevel + 1;

    return true;
};

export const formatTime = (remainingMs: number) =>
{
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const seconds = totalSeconds % 60;

    return `00:${seconds.toString().padStart(2, '0')}`;
};
