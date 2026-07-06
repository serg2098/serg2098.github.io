function getCanvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height)
    };
}

function startShapeDrag(clientX, clientY) {
    if (!gameState.isRunning) return;
    const point = getCanvasPoint(clientX, clientY);
    for (let index = 0; index < gameState.availableShapes.length; index++) {
        const shape = gameState.availableShapes[index];
        if (!shape) continue;
        const previewCellSize = shape.previewCellSize || SHAPE_PREVIEW_CELL_SIZE;
        const bounds = getShapePixelBounds(shape, previewCellSize);
        if (point.x >= shape.baseX && point.x <= shape.baseX + bounds.width &&
            point.y >= shape.baseY && point.y <= shape.baseY + bounds.height) {
            const scaleUp = CELL_SIZE / previewCellSize;
            dragState.shapeIndex = index;
            dragState.pointerX = point.x;
            dragState.pointerY = point.y;
            dragState.offsetX = (point.x - shape.baseX) * scaleUp;
            dragState.offsetY = (point.y - shape.baseY) * scaleUp + DRAG_LIFT_OFFSET;
            playPickupSound();
            requestRedraw();
            break;
        }
    }
}

function moveShapeDrag(clientX, clientY) {
    if (!gameState.isRunning || dragState.shapeIndex === -1) return;
    const point = getCanvasPoint(clientX, clientY);
    dragState.pointerX = point.x;
    dragState.pointerY = point.y;
    requestRedraw();
}

function dropShape(clientX, clientY) {
    if (!gameState.isRunning || dragState.shapeIndex === -1) return;
    moveShapeDrag(clientX, clientY);
    const shape = gameState.availableShapes[dragState.shapeIndex];
    if (!shape) {
        dragState.shapeIndex = -1;
        return;
    }
    const dropX = dragState.pointerX - dragState.offsetX;
    const dropY = dragState.pointerY - dragState.offsetY;
    const gridCol = Math.round(dropX / CELL_SIZE);
    const gridRow = Math.round(dropY / CELL_SIZE);
    const undoCandidate = captureUndoSnapshot();
    const turnResult = placeShapeOnGrid(shape, gridRow, gridCol);
    if (turnResult.success) {
        gameState.availableShapes[dragState.shapeIndex] = null;
        showFloatingPoints(turnResult.pointsEarned);
        if (turnResult.linesCleared > 0) {
            lockUndo();
            playLineClearCue(turnResult.currentCombo);
            if (turnResult.currentCombo > 1) {
                showComboBanner(turnResult.currentCombo);
            }
            gameState.isRunning = false;
            spawnClearParticles(turnResult.rowsToClear, turnResult.colsToClear);
            flashClearedLines(turnResult.rowsToClear, turnResult.colsToClear);
            const tokenAtPlacement = gameState.turnToken;
            setTimeout(() => {
                if (tokenAtPlacement !== gameState.turnToken) return;
                removeCompletedLines(turnResult.rowsToClear, turnResult.colsToClear);
                gameState.score += turnResult.pointsEarned;
                updateScore();
                finalizeTurn();
            }, LINE_CLEAR_COMMIT_DELAY);
        } else {
            playPlaceSound();
            gameState.score += turnResult.pointsEarned;
            updateScore();
            const trayWillRefill = gameState.availableShapes.every(slot => slot === null);
            if (trayWillRefill) {
                lockUndo();
            } else {
                undoSnapshot = undoCandidate;
                setUndoEnabled(true);
            }
            finalizeTurn();
        }
    } else {
        triggerInvalidPlacementFeedback();
    }
    dragState.shapeIndex = -1;
    requestRedraw();
}

function isIqMode() {
    return gameState.mode === 'iq';
}

canvas.addEventListener('mousedown', event => {
    if (isIqMode()) iqPointerDown(event.clientX, event.clientY);
    else startShapeDrag(event.clientX, event.clientY);
});

window.addEventListener('mousemove', event => {
    if (isIqMode()) iqPointerMove(event.clientX, event.clientY);
    else moveShapeDrag(event.clientX, event.clientY);
});

window.addEventListener('mouseup', event => {
    if (isIqMode()) iqPointerUp(event.clientX, event.clientY);
    else dropShape(event.clientX, event.clientY);
});

canvas.addEventListener('touchstart', event => {
    event.preventDefault();
    const touch = event.touches[0];
    if (isIqMode()) iqPointerDown(touch.clientX, touch.clientY);
    else startShapeDrag(touch.clientX, touch.clientY);
}, { passive: false });

window.addEventListener('touchmove', event => {
    if (isIqMode() ? iqState.drag.pieceIndex === -1 : dragState.shapeIndex === -1) return;
    event.preventDefault();
    const touch = event.touches[0];
    if (isIqMode()) iqPointerMove(touch.clientX, touch.clientY);
    else moveShapeDrag(touch.clientX, touch.clientY);
}, { passive: false });

window.addEventListener('touchend', event => {
    if (isIqMode() ? iqState.drag.pieceIndex === -1 : dragState.shapeIndex === -1) return;
    event.preventDefault();
    const touch = event.changedTouches[0];
    if (isIqMode()) iqPointerUp(touch.clientX, touch.clientY);
    else dropShape(touch.clientX, touch.clientY);
}, { passive: false });

window.addEventListener('touchcancel', event => {
    if (isIqMode() ? iqState.drag.pieceIndex === -1 : dragState.shapeIndex === -1) return;
    event.preventDefault();
    const touch = event.changedTouches[0];
    if (isIqMode()) {
        if (touch) iqPointerUp(touch.clientX, touch.clientY);
        else iqState.drag.pieceIndex = -1;
    } else if (touch) {
        dropShape(touch.clientX, touch.clientY);
    } else {
        dragState.shapeIndex = -1;
    }
}, { passive: false });

const modalTransitionTimers = new WeakMap();

function clearModalTransition(modal) {
    const pending = modalTransitionTimers.get(modal);
    if (pending) clearTimeout(pending);
}

function openModal(modal) {
    clearModalTransition(modal);
    modal.style.display = 'flex';
    modalTransitionTimers.set(modal, setTimeout(() => modal.classList.add('active'), 10));
}

function closeModal(modal, afterClose) {
    clearModalTransition(modal);
    modal.classList.remove('active');
    modalTransitionTimers.set(modal, setTimeout(() => {
        modal.style.display = 'none';
        if (afterClose) afterClose();
    }, 300));
}

function buildSkinPicker() {
    const container = document.getElementById('skin-options');
    if (!container) return;
    const skins = [
        { id: 'default',   label: 'Light'     },
        { id: 'neon',      label: 'Neon'      },
        { id: 'lego',      label: 'Lego'      },
        { id: 'wooden',    label: 'Wooden'    },
        { id: 'minecraft', label: 'Minecraft' }
    ];
    skins.forEach(({ id, label }) => {
        const palette = SKIN_PALETTES[id] || {};
        const card = document.createElement('button');
        card.className = 'skin-option-btn';
        card.dataset.skin = id;
        if (id === currentSkin) card.classList.add('active');
        const preview = document.createElement('div');
        preview.className = 'skin-card-preview';
        preview.style.background = palette.gridBg || '#eee';
        ['orange', 'green', 'blue', 'magenta'].forEach(colorId => {
            const swatch = document.createElement('span');
            swatch.className = 'skin-sw';
            swatch.style.background = palette[colorId] || '#999';
            preview.appendChild(swatch);
        });
        const name = document.createElement('div');
        name.className = 'skin-card-name';
        name.textContent = label;
        card.appendChild(preview);
        card.appendChild(name);
        card.addEventListener('click', () => switchSkin(id));
        container.appendChild(card);
    });
}

buildSkinPicker();

function updatePlayLabel() {
    const playLabel = playButton.querySelector('.play-label') || playButton;
    const hasGameInProgress = gameState.score > 0 || gameState.availableShapes.some(shape => shape !== null);
    playLabel.textContent = hasGameInProgress ? 'Resume' : 'Start playing';
}

function returnToMainMenu() {
    if (isIqMode()) iqTeardown();
    updatePlayLabel();
    gameState.isRunning = false;
    gameState.turnToken++;
    stopBackgroundMusic();
    gameScreen.classList.remove('active');
    setTimeout(() => {
        gameScreen.style.display = 'none';
        mainMenu.style.display = 'flex';
        setTimeout(() => mainMenu.classList.add('active'), 50);
    }, 500);
}

function enterGameScreen() {
    mainMenu.classList.remove('active');
    setTimeout(() => {
        mainMenu.style.display = 'none';
        gameScreen.style.display = 'flex';
        setTimeout(() => {
            gameScreen.classList.add('active');
            startGame();
        }, 50);
    }, 500);
}

playButton.addEventListener('click', enterGameScreen);

document.querySelectorAll('.js-play').forEach(button => {
    button.addEventListener('click', enterGameScreen);
});

backButton.addEventListener('click', () => {
    openModal(settingsModal);
    gameState.isRunning = false;
    syncBackgroundMusic();
});

settingsClose.addEventListener('click', () => {
    closeModal(settingsModal, () => {
        if (isIqMode()) {
            if (!iqState.completed) gameState.isRunning = true;
        } else if (gameState.score > 0 || gameState.availableShapes.some(shape => shape !== null)) {
            gameState.isRunning = true;
        }
        syncBackgroundMusic();
    });
});

volumeSlider.value = settings.volume;
volumeSlider.addEventListener('input', () => {
    setMasterVolume(parseFloat(volumeSlider.value));
});

toggleSound.addEventListener('click', () => {
    settings.soundEnabled = !settings.soundEnabled;
    saveSetting('soundEnabled', settings.soundEnabled);
    toggleSound.classList.toggle('active', settings.soundEnabled);
});

toggleMusic.addEventListener('click', () => {
    settings.musicEnabled = !settings.musicEnabled;
    saveSetting('musicEnabled', settings.musicEnabled);
    toggleMusic.classList.toggle('active', settings.musicEnabled);
    syncBackgroundMusic();
});

toggleVibration.addEventListener('click', () => {
    settings.vibrationEnabled = !settings.vibrationEnabled;
    saveSetting('vibrationEnabled', settings.vibrationEnabled);
    toggleVibration.classList.toggle('active', settings.vibrationEnabled);
});

settingsHome.addEventListener('click', () => {
    closeModal(settingsModal, () => {
        if (isIqMode()) iqExitToLevelSelect();
        else returnToMainMenu();
    });
});

settingsReplay.addEventListener('click', () => {
    closeModal(settingsModal, () => {
        if (isIqMode()) iqRestartLevel();
        else startGame(true);
    });
});

changeSkinButton.addEventListener('click', () => {
    closeModal(settingsModal, () => openModal(skinModal));
});

skinBackButton.addEventListener('click', () => {
    closeModal(skinModal, () => openModal(settingsModal));
});

restartButton.addEventListener('click', () => {
    closeModal(gameOverModal, () => startGame(true));
});

undoButton.addEventListener('click', () => {
    if (undoButton.disabled) return;
    undoLastMove();
});

document.querySelectorAll('.brand').forEach(brand => {
    const insideGame = !!brand.closest('#game-screen');
    const insideIqLevels = !!brand.closest('#iq-level-screen');
    const activate = () => {
        if (insideGame) returnToMainMenu();
        else if (insideIqLevels) iqSwitchScreen(iqLevelScreen, mainMenu);
        else window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    brand.addEventListener('click', activate);
    brand.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate();
        }
    });
});

toggleSound.classList.toggle('active', settings.soundEnabled);
toggleMusic.classList.toggle('active', settings.musicEnabled);
toggleVibration.classList.toggle('active', settings.vibrationEnabled);
setUndoEnabled(false);
restoreSavedGame();
updatePlayLabel();
switchSkin(currentSkin);
