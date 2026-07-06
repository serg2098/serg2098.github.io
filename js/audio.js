let audioContext = null;
let masterGainNode = null;

function ensureAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGainNode = audioContext.createGain();
        masterGainNode.gain.value = settings.volume;
        masterGainNode.connect(audioContext.destination);
    }
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
}

function getSfxContext() {
    if (!settings.soundEnabled) return null;
    return ensureAudioContext();
}

function setMasterVolume(volume) {
    settings.volume = volume;
    saveSetting('volume', volume);
    if (masterGainNode) masterGainNode.gain.value = volume;
}

function vibrate(pattern) {
    if (settings.vibrationEnabled && navigator.vibrate) navigator.vibrate(pattern);
}

function playPickupSound() {
    const context = getSfxContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(300, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(150, context.currentTime + 0.04);
    gainNode.gain.setValueAtTime(0.3, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.04);
    oscillator.connect(gainNode);
    gainNode.connect(masterGainNode);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.04);
}

function playPlaceSound() {
    vibrate(10);
    const context = getSfxContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gainNode = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(180, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(60, context.currentTime + 0.12);
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    gainNode.gain.setValueAtTime(0.8, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(masterGainNode);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.12);
}

function playAudioClip(clip) {
    if (!settings.soundEnabled) return;
    try {
        const node = clip.cloneNode(true);
        node.volume = settings.volume;
        node.play().catch(() => {});
    } catch (error) {}
}

function playLineClearCue(streak) {
    vibrate([50, 50, 50]);
    if (!settings.soundEnabled) return;
    if (streak <= 4) playAudioClip(clipLineClear);
    else if (streak <= 9) playAudioClip(clipComboBig);
    else playAudioClip(clipComboEpic);
}

function playGameOverSound() {
    if (!settings.soundEnabled) return;
    clipGameOver.currentTime = 0;
    clipGameOver.volume = settings.volume;
    clipGameOver.play().catch(() => {});
}

function triggerInvalidPlacementFeedback() {
    shakeFramesRemaining = 15;
    shakeStrength = 8;
    vibrate(35);
    const context = getSfxContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(120, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(65, context.currentTime + 0.08);
    gainNode.gain.setValueAtTime(0.22, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
    oscillator.connect(gainNode);
    gainNode.connect(masterGainNode);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
}

const BACKGROUND_MUSIC_NOTES = [261.63, 329.63, 392.00, 329.63, 293.66, 349.23, 440.00, 349.23];
let backgroundMusicInterval = null;
let backgroundMusicGainNode = null;
let backgroundMusicStep = 0;

function startBackgroundMusic() {
    if (backgroundMusicInterval) return;
    let context;
    try {
        context = ensureAudioContext();
    } catch (error) {
        return;
    }
    if (!backgroundMusicGainNode) {
        backgroundMusicGainNode = context.createGain();
        backgroundMusicGainNode.gain.value = 0.10;
        backgroundMusicGainNode.connect(masterGainNode);
    }
    backgroundMusicStep = 0;
    backgroundMusicInterval = setInterval(() => {
        const startTime = context.currentTime;
        const frequency = BACKGROUND_MUSIC_NOTES[backgroundMusicStep % BACKGROUND_MUSIC_NOTES.length];
        const melodyOscillator = context.createOscillator();
        const melodyGain = context.createGain();
        melodyOscillator.type = 'triangle';
        melodyOscillator.frequency.value = frequency;
        melodyGain.gain.setValueAtTime(0.0001, startTime);
        melodyGain.gain.exponentialRampToValueAtTime(1, startTime + 0.03);
        melodyGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.45);
        melodyOscillator.connect(melodyGain);
        melodyGain.connect(backgroundMusicGainNode);
        melodyOscillator.start(startTime);
        melodyOscillator.stop(startTime + 0.5);
        if (backgroundMusicStep % 4 === 0) {
            const bassOscillator = context.createOscillator();
            const bassGain = context.createGain();
            bassOscillator.type = 'sine';
            bassOscillator.frequency.value = frequency / 2;
            bassGain.gain.setValueAtTime(0.0001, startTime);
            bassGain.gain.exponentialRampToValueAtTime(0.7, startTime + 0.05);
            bassGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.65);
            bassOscillator.connect(bassGain);
            bassGain.connect(backgroundMusicGainNode);
            bassOscillator.start(startTime);
            bassOscillator.stop(startTime + 0.7);
        }
        backgroundMusicStep++;
    }, 420);
}

function stopBackgroundMusic() {
    if (backgroundMusicInterval) {
        clearInterval(backgroundMusicInterval);
        backgroundMusicInterval = null;
    }
}

function syncBackgroundMusic() {
    const shouldPlay = settings.musicEnabled && gameState.isRunning && !document.hidden;
    if (shouldPlay) startBackgroundMusic();
    else stopBackgroundMusic();
}

document.addEventListener('visibilitychange', syncBackgroundMusic);
