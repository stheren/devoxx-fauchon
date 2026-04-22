import { useState } from 'react';
import { PhaserGame } from './PhaserGame';

function App()
{
    const [activeSceneKey, setActiveSceneKey] = useState('TitleScene');

    const sceneLabel = ({
        TitleScene: 'Accueil',
        HarvestScene: 'Journee',
        ShopScene: 'Boutique'
    } as Record<string, string>)[activeSceneKey] ?? 'Jeu';

    return (
        <div id="app">
            <aside className="game-panel">
                <div className="brand-row">
                    <div>
                        <p className="eyebrow">Phaser 4 + React</p>
                        <h1>Golden Harvest</h1>
                    </div>
                    <div className="scene-chip">
                        <span className="scene-dot"></span>
                        {sceneLabel}
                    </div>
                </div>

                <div className="icon-strip">
                    <div className="icon-card">
                        <span className="icon-badge">⏱</span>
                        <div>
                            <strong>20s</strong>
                            <small>run</small>
                        </div>
                    </div>
                    <div className="icon-card">
                        <span className="icon-badge">➜</span>
                        <div>
                            <strong>auto</strong>
                            <small>scroll</small>
                        </div>
                    </div>
                    <div className="icon-card">
                        <span className="icon-badge">↕</span>
                        <div>
                            <strong>haut / bas</strong>
                            <small>pilotage</small>
                        </div>
                    </div>
                    <div className="icon-card">
                        <span className="icon-badge">🛒</span>
                        <div>
                            <strong>shop</strong>
                            <small>upgrades</small>
                        </div>
                    </div>
                </div>

                <div className="panel-grid">
                    <div className="panel-block compact">
                        <span className="block-icon">🎮</span>
                        <div>
                            <h2>Input</h2>
                            <p>↑ ↓ / Z W S</p>
                        </div>
                    </div>
                    <div className="panel-block compact">
                        <span className="block-icon">🌾</span>
                        <div>
                            <h2>But</h2>
                            <p>suivre les vagues</p>
                        </div>
                    </div>
                    <div className="panel-block compact">
                        <span className="block-icon">✂</span>
                        <div>
                            <h2>Fauchage</h2>
                            <p>auto a portee</p>
                        </div>
                    </div>
                    <div className="panel-block compact">
                        <span className="block-icon">✦</span>
                        <div>
                            <h2>Loop</h2>
                            <p>run &gt; bilan &gt; shop</p>
                        </div>
                    </div>
                </div>
            </aside>
            <main className="game-shell">
                <PhaserGame currentActiveScene={(scene) => setActiveSceneKey(scene.scene.key)} />
            </main>
        </div>
    );
}

export default App;
