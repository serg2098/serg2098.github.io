const mainMenu = document.getElementById('main-menu');
const gameScreen = document.getElementById('game-screen');
const playButton = document.getElementById('play-button');
const backButton = document.getElementById('back-button');
const restartButton = document.getElementById('restart-button');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('high-score');
const undoButton = document.getElementById('undo-button');
const comboDisplay = document.getElementById('combo-display');
const floatingTextContainer = document.getElementById('floating-text-container');
const gridOverlay = document.getElementById('grid-overlay');
const gameOverModal = document.getElementById('game-over-modal');
const finalScoreElement = document.getElementById('final-score');
const modalBestScoreElement = document.getElementById('modal-best-score');

const settingsModal = document.getElementById('settings-modal');
const settingsClose = document.getElementById('settings-close');
const toggleSound = document.getElementById('toggle-sound');
const toggleMusic = document.getElementById('toggle-bgm');
const toggleVibration = document.getElementById('toggle-vibe');
const settingsHome = document.getElementById('settings-home');
const settingsReplay = document.getElementById('settings-replay');
const changeSkinButton = document.getElementById('theme-switcher-btn');
const skinModal = document.getElementById('skin-modal');
const skinBackButton = document.getElementById('skin-back');
const volumeSlider = document.getElementById('volumeSlider');

function createEmptyGrid() {
    return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
}

const gameState = {
    mode: 'classic',
    grid: createEmptyGrid(),
    availableShapes: [],
    score: 0,
    comboStreak: 0,
    clearedLineThisRound: false,
    isRunning: false,
    turnToken: 0
};

const settings = {
    soundEnabled: loadBooleanSetting('soundEnabled', true),
    musicEnabled: loadBooleanSetting('musicEnabled', false),
    vibrationEnabled: loadBooleanSetting('vibrationEnabled', true),
    volume: loadNumberSetting('volume', 0.8, 0, 1)
};

let highScore = loadNumberSetting('highScore', 0, 0, Number.MAX_SAFE_INTEGER);
highScoreElement.textContent = formatScore(highScore);

const dragState = {
    shapeIndex: -1,
    pointerX: 0,
    pointerY: 0,
    offsetX: 0,
    offsetY: 0
};

let particles = [];
let shakeFramesRemaining = 0;
let shakeStrength = 0;
let renderLoopStarted = false;
let needsRedraw = true;
let undoSnapshot = null;
