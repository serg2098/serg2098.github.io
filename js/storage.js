const STORAGE_PREFIX = 'puzzleblast.';

function storageKey(name) {
    return STORAGE_PREFIX + name;
}

function saveSetting(name, value) {
    try {
        localStorage.setItem(storageKey(name), JSON.stringify(value));
    } catch (error) {}
}

function removeSetting(name) {
    try {
        localStorage.removeItem(storageKey(name));
    } catch (error) {}
}

function loadSetting(name, fallback) {
    try {
        const raw = localStorage.getItem(storageKey(name));
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch (error) {
        return fallback;
    }
}

function loadNumberSetting(name, fallback, minimum, maximum) {
    const value = loadSetting(name, fallback);
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(maximum, Math.max(minimum, value));
}

function loadBooleanSetting(name, fallback) {
    const value = loadSetting(name, fallback);
    return typeof value === 'boolean' ? value : fallback;
}

function loadStringSetting(name, fallback) {
    const value = loadSetting(name, fallback);
    return typeof value === 'string' ? value : fallback;
}

function migrateLegacyStorage() {
    const migrations = [
        ['block_blast_highscore', 'highScore', raw => Number(raw)],
        ['gameVolume', 'volume', raw => Number(raw)],
        ['selectedSkin', 'skin', raw => raw],
        ['bb_sound', 'soundEnabled', raw => raw === '1'],
        ['bb_music', 'musicEnabled', raw => raw === '1'],
        ['bb_vibe', 'vibrationEnabled', raw => raw === '1']
    ];
    for (const [legacyKey, newName, convert] of migrations) {
        try {
            const legacyValue = localStorage.getItem(legacyKey);
            if (legacyValue === null) continue;
            if (localStorage.getItem(storageKey(newName)) === null) {
                const converted = convert(legacyValue);
                const isInvalidNumber = typeof converted === 'number' && !Number.isFinite(converted);
                if (!isInvalidNumber) saveSetting(newName, converted);
            }
            localStorage.removeItem(legacyKey);
        } catch (error) {}
    }
}

migrateLegacyStorage();
