function startGame(forceRestart = false) {
    if (forceRestart || gameState.availableShapes.length === 0) {
        resetGameState();
    }
    gameState.isRunning = true;
    gameState.turnToken++;
    comboDisplay.classList.remove('pop');
    requestRedraw();
    fitBoard();
    syncBackgroundMusic();
    if (!renderLoopStarted) {
        renderLoopStarted = true;
        requestAnimationFrame(runRenderLoop);
    }
}

function resetGameState() {
    gameState.grid = createEmptyGrid();
    gameState.score = 0;
    gameState.comboStreak = 0;
    gameState.clearedLineThisRound = false;
    lockUndo();
    floatingTextContainer.innerHTML = '';
    updateScore();
    const obstacleTarget = Math.floor(Math.random() * 6) + 10;
    let placedObstacles = 0;
    const rowCounts = Array(GRID_SIZE).fill(0);
    const colCounts = Array(GRID_SIZE).fill(0);
    while (placedObstacles < obstacleTarget) {
        const row = Math.floor(Math.random() * GRID_SIZE);
        const col = Math.floor(Math.random() * GRID_SIZE);
        if (gameState.grid[row][col] === 0 && rowCounts[row] < 6 && colCounts[col] < 6) {
            gameState.grid[row][col] = 'obstacle';
            rowCounts[row]++;
            colCounts[col]++;
            placedObstacles++;
        }
    }
    gameState.availableShapes = [];
    refillShapeTray();
    saveGameState();
}

function canPlaceShapeAt(shape, gridRow, gridCol) {
    for (let row = 0; row < shape.blocks.length; row++) {
        for (let col = 0; col < shape.blocks[row].length; col++) {
            if (shape.blocks[row][col] === 1) {
                const targetRow = gridRow + row;
                const targetCol = gridCol + col;
                if (targetRow < 0 || targetRow >= GRID_SIZE || targetCol < 0 || targetCol >= GRID_SIZE ||
                    gameState.grid[targetRow][targetCol] !== 0) {
                    return false;
                }
            }
        }
    }
    return true;
}

function shuffleArray(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

function refillShapeTray() {
    gameState.availableShapes = [];
    let maxFill = 0;
    let targetEmptyCells = [];
    for (let row = 0; row < GRID_SIZE; row++) {
        const count = gameState.grid[row].filter(cell => cell !== 0).length;
        if (count > maxFill && count < GRID_SIZE) {
            maxFill = count;
            targetEmptyCells = [];
            for (let col = 0; col < GRID_SIZE; col++) {
                if (gameState.grid[row][col] === 0) targetEmptyCells.push({ row, col });
            }
        } else if (count === maxFill && count < GRID_SIZE) {
            for (let col = 0; col < GRID_SIZE; col++) {
                if (gameState.grid[row][col] === 0) targetEmptyCells.push({ row, col });
            }
        }
    }
    for (let col = 0; col < GRID_SIZE; col++) {
        let count = 0;
        const emptyInColumn = [];
        for (let row = 0; row < GRID_SIZE; row++) {
            if (gameState.grid[row][col] !== 0) count++;
            else emptyInColumn.push({ row, col });
        }
        if (count > maxFill && count < GRID_SIZE) {
            maxFill = count;
            targetEmptyCells = emptyInColumn;
        } else if (count === maxFill && count < GRID_SIZE) {
            targetEmptyCells.push(...emptyInColumn);
        }
    }
    let helpfulShape = null;
    if (targetEmptyCells.length > 0) {
        for (const definition of shuffleArray(SHAPE_DEFINITIONS)) {
            let fits = false;
            for (const target of targetEmptyCells) {
                for (let shapeRow = 0; shapeRow < definition.blocks.length; shapeRow++) {
                    for (let shapeCol = 0; shapeCol < definition.blocks[0].length; shapeCol++) {
                        if (definition.blocks[shapeRow][shapeCol] === 1) {
                            if (canPlaceShapeAt(definition, target.row - shapeRow, target.col - shapeCol)) {
                                fits = true;
                                break;
                            }
                        }
                    }
                    if (fits) break;
                }
                if (fits) break;
            }
            if (fits) {
                helpfulShape = definition;
                break;
            }
        }
    }
    const pickRandomDefinition = () => SHAPE_DEFINITIONS[Math.floor(Math.random() * SHAPE_DEFINITIONS.length)];
    const newShapes = shuffleArray([
        helpfulShape || pickRandomDefinition(),
        pickRandomDefinition(),
        pickRandomDefinition()
    ]).map(cloneShapeWithRandomColor);
    const trayTop = GRID_SIZE * CELL_SIZE + 45;
    const slotWidth = canvas.width / 3;
    for (let slot = 0; slot < 3; slot++) {
        const shape = newShapes[slot];
        const previewCellSize = getPreviewCellSize(shape, slotWidth);
        const bounds = getShapePixelBounds(shape, previewCellSize);
        const slotCenterX = slotWidth * slot + slotWidth / 2;
        gameState.availableShapes.push({
            blocks: shape.blocks,
            colorId: shape.colorId,
            previewCellSize,
            baseX: slotCenterX - bounds.width / 2,
            baseY: trayTop + 20
        });
    }
    requestRedraw();
}

function updateScore() {
    requestRedraw();
    scoreElement.textContent = formatScore(gameState.score);
    if (gameState.score > highScore) {
        highScore = gameState.score;
        saveSetting('highScore', highScore);
        highScoreElement.textContent = formatScore(highScore);
    }
}

function animateScoreCountUp(element, target, duration = 600) {
    const startTime = performance.now();
    function tick(now) {
        const progress = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = formatScore(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function calculateTurnPoints(blockCount, linesCleared) {
    let points = blockCount;
    if (linesCleared > 0) {
        gameState.clearedLineThisRound = true;
        gameState.comboStreak += 1;
        let linePoints = 0;
        if (linesCleared === 1) linePoints = 10;
        else if (linesCleared === 2) linePoints = 30;
        else if (linesCleared === 3) linePoints = 60;
        else linePoints = 100;
        points += linePoints;
        points += (gameState.comboStreak - 1) * 10 * linesCleared;
    }
    return points;
}

function findCompletedLines() {
    const rowsToClear = [];
    const colsToClear = [];
    for (let row = 0; row < GRID_SIZE; row++) {
        if (gameState.grid[row].every(cell => cell !== 0)) rowsToClear.push(row);
    }
    for (let col = 0; col < GRID_SIZE; col++) {
        let isFull = true;
        for (let row = 0; row < GRID_SIZE; row++) {
            if (gameState.grid[row][col] === 0) { isFull = false; break; }
        }
        if (isFull) colsToClear.push(col);
    }
    return { rowsToClear, colsToClear };
}

function placeShapeOnGrid(shape, gridRow, gridCol) {
    if (!canPlaceShapeAt(shape, gridRow, gridCol)) return { success: false };
    let blockCount = 0;
    for (let row = 0; row < shape.blocks.length; row++) {
        for (let col = 0; col < shape.blocks[row].length; col++) {
            if (shape.blocks[row][col] === 1) {
                gameState.grid[gridRow + row][gridCol + col] = shape.colorId;
                blockCount++;
            }
        }
    }
    const { rowsToClear, colsToClear } = findCompletedLines();
    const linesCleared = rowsToClear.length + colsToClear.length;
    const pointsEarned = calculateTurnPoints(blockCount, linesCleared);
    return {
        success: true,
        linesCleared,
        pointsEarned,
        currentCombo: gameState.comboStreak,
        rowsToClear,
        colsToClear
    };
}

function hasNoRemainingMoves() {
    for (const shape of gameState.availableShapes) {
        if (!shape) continue;
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                if (canPlaceShapeAt(shape, row, col)) return false;
            }
        }
    }
    return true;
}

function handleGameOver() {
    gameState.isRunning = false;
    lockUndo();
    stopBackgroundMusic();
    removeSetting('currentGame');
    playGameOverSound();
    if (gameState.score > highScore) {
        highScore = gameState.score;
        saveSetting('highScore', highScore);
        highScoreElement.textContent = formatScore(highScore);
    }
    modalBestScoreElement.textContent = formatScore(highScore);
    openModal(gameOverModal);
    animateScoreCountUp(finalScoreElement, gameState.score);
}

function finalizeTurn() {
    const trayEmpty = gameState.availableShapes.every(shape => shape === null);
    if (trayEmpty) {
        if (!gameState.clearedLineThisRound) gameState.comboStreak = 0;
        gameState.clearedLineThisRound = false;
        refillShapeTray();
    }
    if (hasNoRemainingMoves()) {
        handleGameOver();
    } else {
        gameState.isRunning = true;
        saveGameState();
    }
}

function captureUndoSnapshot() {
    return {
        grid: gameState.grid.map(row => row.slice()),
        availableShapes: gameState.availableShapes.map(shape => shape ? {
            blocks: shape.blocks.map(row => row.slice()),
            colorId: shape.colorId,
            previewCellSize: shape.previewCellSize,
            baseX: shape.baseX,
            baseY: shape.baseY
        } : null),
        score: gameState.score,
        comboStreak: gameState.comboStreak,
        clearedLineThisRound: gameState.clearedLineThisRound
    };
}

function setUndoEnabled(enabled) {
    if (!undoButton) return;
    undoButton.disabled = !enabled;
    undoButton.classList.toggle('disabled', !enabled);
}

function lockUndo() {
    undoSnapshot = null;
    setUndoEnabled(false);
}

function undoLastMove() {
    if (!undoSnapshot) return;
    gameState.grid = undoSnapshot.grid.map(row => row.slice());
    gameState.availableShapes = undoSnapshot.availableShapes.map(shape => shape ? {
        blocks: shape.blocks.map(row => row.slice()),
        colorId: shape.colorId,
        previewCellSize: shape.previewCellSize,
        baseX: shape.baseX,
        baseY: shape.baseY
    } : null);
    gameState.score = undoSnapshot.score;
    gameState.comboStreak = undoSnapshot.comboStreak;
    gameState.clearedLineThisRound = undoSnapshot.clearedLineThisRound;
    updateScore();
    lockUndo();
    gameState.isRunning = true;
    saveGameState();
    requestRedraw();
}

function saveGameState() {
    saveSetting('currentGame', {
        grid: gameState.grid,
        availableShapes: gameState.availableShapes,
        score: gameState.score,
        comboStreak: gameState.comboStreak,
        clearedLineThisRound: gameState.clearedLineThisRound,
        undoSnapshot
    });
}

function restoreSavedGame() {
    const saved = loadSetting('currentGame', null);
    if (!saved || !Array.isArray(saved.grid) || saved.grid.length !== GRID_SIZE) return false;
    if (!Array.isArray(saved.availableShapes)) return false;
    gameState.grid = saved.grid;
    gameState.availableShapes = saved.availableShapes;
    gameState.score = typeof saved.score === 'number' ? saved.score : 0;
    gameState.comboStreak = typeof saved.comboStreak === 'number' ? saved.comboStreak : 0;
    gameState.clearedLineThisRound = !!saved.clearedLineThisRound;
    undoSnapshot = saved.undoSnapshot || null;
    setUndoEnabled(!!undoSnapshot);
    updateScore();
    return true;
}

function showComboBanner(streak) {
    comboDisplay.textContent = `COMBO x${streak}!`;
    comboDisplay.classList.remove('pop');
    void comboDisplay.offsetWidth;
    comboDisplay.classList.add('pop');
}

function showFloatingPoints(points) {
    if (points <= 0) return;
    const floatingText = document.createElement('span');
    floatingText.textContent = `+${points}`;
    floatingText.classList.add('floating-text');
    floatingTextContainer.appendChild(floatingText);
    setTimeout(() => floatingText.remove(), 800);
}

function spawnClearParticles(rows, cols) {
    const cells = [];
    const seen = new Set();
    rows.forEach(row => {
        for (let col = 0; col < GRID_SIZE; col++) {
            const key = `${row}:${col}`;
            if (!seen.has(key)) {
                seen.add(key);
                cells.push({ row, col });
            }
        }
    });
    cols.forEach(col => {
        for (let row = 0; row < GRID_SIZE; row++) {
            const key = `${row}:${col}`;
            if (!seen.has(key)) {
                seen.add(key);
                cells.push({ row, col });
            }
        }
    });
    cells.forEach(({ row, col }) => {
        const cellValue = gameState.grid[row][col];
        if (!cellValue) return;
        const originX = col * CELL_SIZE + CELL_SIZE / 2;
        const originY = row * CELL_SIZE + CELL_SIZE / 2;
        const color = getThemeColor(cellValue);
        const count = 8 + Math.floor(Math.random() * 5);
        for (let index = 0; index < count; index++) {
            particles.push({
                x: originX,
                y: originY,
                velocityX: Math.random() * 6 - 3,
                velocityY: -5 + Math.random() * 4,
                size: 3 + Math.random() * 5,
                color,
                alpha: 1,
                gravity: 0.2
            });
        }
    });
}

function flashClearedLines(rows, cols) {
    rows.forEach(row => {
        for (let col = 0; col < GRID_SIZE; col++) appendFlashCell(row, col);
    });
    cols.forEach(col => {
        for (let row = 0; row < GRID_SIZE; row++) {
            if (!rows.includes(row)) appendFlashCell(row, col);
        }
    });
}

function appendFlashCell(row, col) {
    const flash = document.createElement('div');
    flash.classList.add('flashing');
    flash.style.left = `${col * CELL_SIZE + 2}px`;
    flash.style.top = `${row * CELL_SIZE + 2}px`;
    flash.style.width = `${CELL_SIZE - 4}px`;
    flash.style.height = `${CELL_SIZE - 4}px`;
    const cellValue = gameState.grid[row][col];
    if (cellValue && cellValue !== 0) {
        const resolved = getThemeColor(cellValue);
        flash.style.backgroundColor = (resolved === getThemeColor('obstacle')) ? 'white' : resolved;
    } else {
        flash.style.backgroundColor = 'white';
    }
    gridOverlay.appendChild(flash);
    setTimeout(() => flash.remove(), 250);
}

function removeCompletedLines(rows, cols) {
    rows.forEach(row => { for (let col = 0; col < GRID_SIZE; col++) gameState.grid[row][col] = 0; });
    cols.forEach(col => { for (let row = 0; row < GRID_SIZE; row++) gameState.grid[row][col] = 0; });
    requestRedraw();
}
