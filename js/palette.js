const SKIN_PALETTES = {
    default: {
        green:    '#26d6a6',
        blue:     '#4fa4ff',
        yellow:   '#ffcb45',
        orange:   '#ff9f43',
        purple:   '#b274f4',
        cyan:     '#3ec9dd',
        magenta:  '#ff6fb3',
        red:      '#ff6b5e',
        obstacle: '#9fb0c6',
        gridBg:   '#dfe9f7',
        panelBg:  '#ffffff',
        emptyCell: '#e9eff8',
        emptyBorder: 'none',
        separator: 'rgba(40, 60, 100, 0.08)'
    },
    neon: {
        green:    '#39ff14',
        blue:     '#00f3ff',
        yellow:   '#ffe600',
        orange:   '#ff6a00',
        purple:   '#b500ff',
        cyan:     '#00fff0',
        magenta:  '#ff00d4',
        red:      '#ff0055',
        obstacle: '#2a3a44',
        gridBg:   '#0f1a2b',
        panelBg:  '#0a1120',
        emptyCell: '#16243a',
        emptyBorder: 'rgba(70, 210, 240, 0.20)',
        separator: 'rgba(69, 162, 158, 0.4)'
    },
    lego: {
        green:    '#4B9F3F',
        blue:     '#0050A0',
        yellow:   '#F3C300',
        orange:   '#E66E25',
        purple:   '#6B2FA0',
        cyan:     '#00A3DA',
        magenta:  '#D3359D',
        red:      '#E60012',
        obstacle: '#8a97a3',
        gridBg:   '#c4c9ce',
        panelBg:  '#a9afb5',
        emptyCell: '#bcc2c8',
        emptyBorder: 'rgba(0, 0, 0, 0.16)',
        separator: 'rgba(0, 0, 0, 0.12)'
    },
    wooden: {
        green:    '#cdb59a',
        blue:     '#9a6740',
        yellow:   '#e7cda3',
        orange:   '#e0a85f',
        purple:   '#a86a43',
        cyan:     '#d8b483',
        magenta:  '#b5654d',
        red:      '#c69b63',
        obstacle: '#5e4631',
        gridBg:   '#b58c63',
        panelBg:  '#7a5a3a',
        emptyCell: '#a47d56',
        emptyBorder: 'rgba(0, 0, 0, 0.15)',
        separator: 'rgba(0, 0, 0, 0.18)'
    },
    minecraft: {
        green:    '#17c06a',
        blue:     '#1f49b0',
        yellow:   '#f7d343',
        orange:   '#c0734a',
        purple:   '#8d5fc4',
        magenta:  '#ab5fa8',
        cyan:     '#6fd8d2',
        red:      '#c01f1f',
        obstacle: '#6f6f6f',
        gridBg:   '#8c8c8c',
        panelBg:  '#6e6e6e',
        emptyCell: '#7e7e7e',
        emptyBorder: 'rgba(0, 0, 0, 0.25)',
        separator: 'rgba(0, 0, 0, 0.2)'
    }
};

const SKIN_CHROME = {
    default:   { scoreInk: '#21314f', scoreGlow: '0 2px 6px rgba(40,60,100,0.18)' },
    neon:      { scoreInk: '#ffffff', scoreGlow: '0 0 14px rgba(102,252,241,0.55)' },
    lego:      { scoreInk: '#1c2530', scoreGlow: '0 2px 5px rgba(0,0,0,0.25)' },
    wooden:    { scoreInk: '#3a2618', scoreGlow: '0 2px 6px rgba(60,40,20,0.35)' },
    minecraft: { scoreInk: '#ffffff', scoreGlow: '0 2px 5px rgba(0,0,0,0.7)' }
};

const SKIN_THEME_CLASSES = Object.keys(SKIN_PALETTES).map(name => 'theme-' + name);
const BLOCK_COLOR_IDS = ['green', 'blue', 'yellow', 'orange', 'purple', 'cyan', 'magenta', 'red'];

let currentSkin = loadStringSetting('skin', 'default');
if (!SKIN_PALETTES[currentSkin]) currentSkin = 'default';

function getThemeColor(colorId) {
    const palette = SKIN_PALETTES[currentSkin] || SKIN_PALETTES.default;
    return palette[colorId] || colorId;
}

function pickRandomBlockColor() {
    return BLOCK_COLOR_IDS[Math.floor(Math.random() * BLOCK_COLOR_IDS.length)];
}

function cloneShapeWithRandomColor(definition) {
    return {
        blocks: definition.blocks.map(row => [...row]),
        colorId: pickRandomBlockColor()
    };
}

function lightenHex(hex, amount) {
    const packed = parseInt(hex.replace('#', ''), 16);
    const red = Math.min(255, (packed >> 16) + amount);
    const green = Math.min(255, ((packed >> 8) & 0xff) + amount);
    const blue = Math.min(255, (packed & 0xff) + amount);
    return '#' + ((red << 16) | (green << 8) | blue).toString(16).padStart(6, '0');
}

function applySkinChrome(skinName) {
    const palette = SKIN_PALETTES[skinName] || SKIN_PALETTES.default;
    const chrome = SKIN_CHROME[skinName] || SKIN_CHROME.default;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--board-inner', palette.gridBg);
    rootStyle.setProperty('--board-frame', palette.panelBg);
    rootStyle.setProperty('--score-ink', chrome.scoreInk);
    rootStyle.setProperty('--score-glow', chrome.scoreGlow);
}

function switchSkin(skinName) {
    currentSkin = skinName;
    saveSetting('skin', skinName);
    document.body.classList.remove(...SKIN_THEME_CLASSES);
    document.body.classList.add('theme-' + skinName);
    applySkinChrome(skinName);
    document.querySelectorAll('.skin-option-btn').forEach(button => {
        button.classList.toggle('active', button.dataset.skin === skinName);
    });
    if (typeof requestRedraw === 'function') requestRedraw();
}
