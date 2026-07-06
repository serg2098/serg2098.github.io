function getShapePixelBounds(shape, cellSize) {
    const widthInCells = Math.max(...shape.blocks.map(row => row.length));
    const heightInCells = shape.blocks.length;
    return {
        width: widthInCells * cellSize,
        height: heightInCells * cellSize
    };
}

function getPreviewCellSize(shape, slotWidth = canvas.width / 3) {
    const widthInCells = Math.max(...shape.blocks.map(row => row.length));
    const maxPreviewWidth = Math.max(CELL_SIZE, slotWidth - SHAPE_SLOT_GAP * 2);
    return Math.min(SHAPE_PREVIEW_CELL_SIZE, maxPreviewWidth / widthInCells);
}

const MINECRAFT_TEXTURES = {
    green:    'emerald_block',
    blue:     'lapis_block',
    yellow:   'gold_block',
    orange:   'copper_block',
    purple:   'amethyst_block',
    magenta:  'purpur_block',
    cyan:     'diamond_block',
    red:      'redstone_block',
    obstacle: 'stone'
};
const minecraftTextureImages = {};

function preloadMinecraftTextures() {
    for (const textureName of new Set(Object.values(MINECRAFT_TEXTURES))) {
        if (minecraftTextureImages[textureName]) continue;
        const image = new Image();
        image.src = 'blocks/' + textureName + '.png';
        minecraftTextureImages[textureName] = image;
    }
}

preloadMinecraftTextures();

function buildFrameTheme() {
    return {
        gridBackground: getThemeColor('gridBg'),
        obstacle: getThemeColor('obstacle'),
        emptyFill: getThemeColor('emptyCell'),
        emptyBorder: getThemeColor('emptyBorder')
    };
}

function drawTile(context, x, y, size, colorId, isGhost, frameTheme) {
    const hexColor = getThemeColor(colorId);
    if (hexColor === frameTheme.gridBackground) {
        drawEmptyCell(context, x, y, size, frameTheme);
        return;
    }
    if (isGhost) {
        context.globalAlpha = 0.35;
        context.fillStyle = hexColor;
        context.beginPath();
        context.roundRect(x + 1, y + 1, size - 2, size - 2, 4);
        context.fill();
        context.globalAlpha = 1.0;
        return;
    }
    const renderTile = SKIN_RENDERERS[currentSkin] || drawBevelTile;
    renderTile(context, x, y, size, colorId, hexColor, hexColor === frameTheme.obstacle);
}

function drawEmptyCell(context, x, y, size, frameTheme) {
    const fill = frameTheme.emptyFill;
    if (fill && fill !== 'transparent' && fill !== 'none') {
        context.fillStyle = fill;
        context.beginPath();
        context.roundRect(x + 1, y + 1, size - 2, size - 2, 8);
        context.fill();
    }
    const border = frameTheme.emptyBorder;
    if (border && border !== 'none') {
        context.strokeStyle = border;
        context.lineWidth = 1.5;
        context.beginPath();
        context.roundRect(x + 1.75, y + 1.75, size - 3.5, size - 3.5, 7);
        context.stroke();
    }
}

function drawBevelTile(context, x, y, size, colorId, hexColor, isObstacle) {
    if (isObstacle) {
        context.fillStyle = hexColor;
        context.beginPath();
        context.roundRect(x + 1, y + 1, size - 2, size - 2, 4);
        context.fill();
        return;
    }
    context.fillStyle = hexColor;
    context.beginPath();
    context.roundRect(x, y, size, size, 4);
    context.fill();
    context.save();
    context.beginPath();
    context.roundRect(x, y, size, size, 4);
    context.clip();
    const bevel = Math.max(2, size * 0.12);
    context.fillStyle = 'rgba(255, 255, 255, 0.4)';
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + size, y);
    context.lineTo(x + size - bevel, y + bevel);
    context.lineTo(x + bevel, y + bevel);
    context.fill();
    context.fillStyle = 'rgba(255, 255, 255, 0.2)';
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + bevel, y + bevel);
    context.lineTo(x + bevel, y + size - bevel);
    context.lineTo(x, y + size);
    context.fill();
    context.fillStyle = 'rgba(0, 0, 0, 0.1)';
    context.beginPath();
    context.moveTo(x + size, y);
    context.lineTo(x + size, y + size);
    context.lineTo(x + size - bevel, y + size - bevel);
    context.lineTo(x + size - bevel, y + bevel);
    context.fill();
    context.fillStyle = 'rgba(0, 0, 0, 0.35)';
    context.beginPath();
    context.moveTo(x, y + size);
    context.lineTo(x + bevel, y + size - bevel);
    context.lineTo(x + size - bevel, y + size - bevel);
    context.lineTo(x + size, y + size);
    context.fill();
    context.fillStyle = hexColor;
    context.beginPath();
    context.roundRect(x + bevel, y + bevel, size - bevel * 2, size - bevel * 2, Math.max(1, 4 - bevel / 2));
    context.fill();
    context.restore();
}

function drawNeonTile(context, x, y, size, colorId, hexColor) {
    context.save();
    context.shadowColor = hexColor;
    context.shadowBlur = 14;
    context.fillStyle = 'rgba(255, 255, 255, 0.08)';
    context.beginPath();
    context.roundRect(x + 2, y + 2, size - 4, size - 4, 6);
    context.fill();
    context.shadowBlur = 8;
    context.strokeStyle = hexColor;
    context.lineWidth = 2.5;
    context.beginPath();
    context.roundRect(x + 2, y + 2, size - 4, size - 4, 6);
    context.stroke();
    context.shadowBlur = 0;
    context.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(x + 3.5, y + 3.5, size - 7, size - 7, 5);
    context.stroke();
    context.restore();
}

function drawLegoTile(context, x, y, size, colorId, hexColor, isObstacle) {
    const radius = 3;
    context.fillStyle = 'rgba(0,0,0,0.28)';
    context.beginPath();
    context.roundRect(x + 1, y + 2, size - 2, size - 2, radius);
    context.fill();
    context.fillStyle = hexColor;
    context.beginPath();
    context.roundRect(x, y, size - 1, size - 1, radius);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.22)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(x + radius, y + 1);
    context.lineTo(x + size - 2, y + 1);
    context.stroke();
    context.beginPath();
    context.moveTo(x + 1, y + radius);
    context.lineTo(x + 1, y + size - 2);
    context.stroke();
    if (isObstacle) return;
    const studRadius = size * 0.18;
    const centerX = x + size / 2 - 0.5;
    const centerY = y + size / 2 - 0.5;
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.arc(centerX, centerY + 1.5, studRadius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = lightenHex(hexColor, 28);
    context.beginPath();
    context.arc(centerX, centerY, studRadius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.42)';
    context.lineWidth = size * 0.05;
    context.beginPath();
    context.arc(centerX, centerY, studRadius - context.lineWidth / 2, Math.PI * 1.0, Math.PI * 1.65);
    context.stroke();
    context.strokeStyle = 'rgba(0,0,0,0.18)';
    context.lineWidth = size * 0.04;
    context.beginPath();
    context.arc(centerX, centerY, studRadius - context.lineWidth, 0, Math.PI * 0.6);
    context.stroke();
}

function drawWoodenTile(context, x, y, size, colorId, hexColor, isObstacle) {
    const radius = Math.max(3, size * 0.1);
    context.fillStyle = hexColor;
    context.beginPath();
    context.roundRect(x + 1, y + 1, size - 2, size - 2, radius);
    context.fill();
    context.save();
    context.beginPath();
    context.roundRect(x + 1, y + 1, size - 2, size - 2, radius);
    context.clip();
    context.strokeStyle = 'rgba(70, 45, 25, 0.14)';
    context.lineWidth = Math.max(1, size * 0.018);
    const grainLines = 4;
    for (let line = 1; line <= grainLines; line++) {
        const grainX = x + (size * line) / (grainLines + 1);
        context.beginPath();
        context.moveTo(grainX, y + 2);
        context.quadraticCurveTo(grainX + size * 0.06, y + size * 0.5, grainX, y + size - 2);
        context.stroke();
    }
    context.strokeStyle = 'rgba(255, 245, 225, 0.16)';
    context.lineWidth = Math.max(1, size * 0.012);
    for (let line = 1; line <= 2; line++) {
        const grainX = x + (size * (line + 0.5)) / (grainLines + 1);
        context.beginPath();
        context.moveTo(grainX, y + 2);
        context.quadraticCurveTo(grainX - size * 0.05, y + size * 0.5, grainX, y + size - 2);
        context.stroke();
    }
    if (!isObstacle) {
        const edge = Math.max(2, size * 0.12);
        context.fillStyle = 'rgba(255, 245, 225, 0.28)';
        context.fillRect(x + 1, y + 1, size - 2, edge);
        context.fillStyle = 'rgba(60, 38, 20, 0.22)';
        context.fillRect(x + 1, y + size - 1 - edge, size - 2, edge);
    }
    context.restore();
    context.strokeStyle = 'rgba(60, 38, 20, 0.25)';
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(x + 1.5, y + 1.5, size - 3, size - 3, radius - 1);
    context.stroke();
}

function drawMinecraftTile(context, x, y, size, colorId, hexColor, isObstacle) {
    const innerX = x + 1;
    const innerY = y + 1;
    const innerSize = size - 2;
    const texture = minecraftTextureImages[MINECRAFT_TEXTURES[colorId]];
    if (texture && texture.complete && texture.naturalWidth > 0) {
        const previousSmoothing = context.imageSmoothingEnabled;
        context.imageSmoothingEnabled = false;
        context.drawImage(texture, innerX, innerY, innerSize, innerSize);
        context.imageSmoothingEnabled = previousSmoothing;
        context.strokeStyle = 'rgba(0,0,0,0.30)';
        context.lineWidth = 1;
        context.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);
        return;
    }
    context.fillStyle = hexColor;
    context.fillRect(innerX, innerY, innerSize, innerSize);
    const speckleGrid = 4;
    const speckleSize = innerSize / speckleGrid;
    const seed = (Math.round(x) * 73856093) ^ (Math.round(y) * 19349663);
    for (let row = 0; row < speckleGrid; row++) {
        for (let col = 0; col < speckleGrid; col++) {
            const hash = (seed + row * 374761393 + col * 668265263) >>> 0;
            const variant = hash % 7;
            if (variant === 0) context.fillStyle = 'rgba(255,255,255,0.16)';
            else if (variant === 1) context.fillStyle = 'rgba(0,0,0,0.16)';
            else continue;
            context.fillRect(innerX + col * speckleSize, innerY + row * speckleSize, Math.ceil(speckleSize), Math.ceil(speckleSize));
        }
    }
    const edge = Math.max(2, size * 0.09);
    context.fillStyle = 'rgba(255,255,255,0.30)';
    context.fillRect(innerX, innerY, innerSize, edge);
    context.fillRect(innerX, innerY, edge, innerSize);
    context.fillStyle = 'rgba(0,0,0,0.32)';
    context.fillRect(innerX, innerY + innerSize - edge, innerSize, edge);
    context.fillRect(innerX + innerSize - edge, innerY, edge, innerSize);
    context.strokeStyle = 'rgba(0,0,0,0.35)';
    context.lineWidth = 1;
    context.strokeRect(innerX + 0.5, innerY + 0.5, innerSize - 1, innerSize - 1);
}

const SKIN_RENDERERS = {
    default: drawBevelTile,
    neon: drawNeonTile,
    lego: drawLegoTile,
    wooden: drawWoodenTile,
    minecraft: drawMinecraftTile
};

function drawGame() {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    const frameTheme = buildFrameTheme();
    let shaken = false;
    if (shakeFramesRemaining > 0) {
        const offsetX = (Math.random() - 0.5) * shakeStrength;
        const offsetY = (Math.random() - 0.5) * shakeStrength;
        canvasContext.save();
        canvasContext.translate(offsetX, offsetY);
        shakeFramesRemaining--;
        shakeStrength *= 0.92;
        shaken = true;
    }
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const cell = gameState.grid[row][col];
            const colorId = cell !== 0 ? cell : 'gridBg';
            drawTile(canvasContext, col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, colorId, false, frameTheme);
        }
    }
    gameState.availableShapes.forEach((shape, index) => {
        if (!shape) return;
        if (index === dragState.shapeIndex) return;
        drawShape(shape, shape.baseX, shape.baseY, false, frameTheme);
    });
    if (dragState.shapeIndex !== -1 && gameState.availableShapes[dragState.shapeIndex]) {
        const shape = gameState.availableShapes[dragState.shapeIndex];
        const dropX = dragState.pointerX - dragState.offsetX;
        const dropY = dragState.pointerY - dragState.offsetY;
        const gridCol = Math.round(dropX / CELL_SIZE);
        const gridRow = Math.round(dropY / CELL_SIZE);
        if (canPlaceShapeAt(shape, gridRow, gridCol)) {
            canvasContext.globalAlpha = 0.3;
            for (let row = 0; row < shape.blocks.length; row++) {
                for (let col = 0; col < shape.blocks[row].length; col++) {
                    if (shape.blocks[row][col] === 1) {
                        drawTile(canvasContext, (gridCol + col) * CELL_SIZE, (gridRow + row) * CELL_SIZE, CELL_SIZE, shape.colorId, true, frameTheme);
                    }
                }
            }
            canvasContext.globalAlpha = 1.0;
            const predictedRows = [];
            const predictedCols = [];
            for (let row = 0; row < GRID_SIZE; row++) {
                let isFull = true;
                for (let col = 0; col < GRID_SIZE; col++) {
                    const shapeRow = row - gridRow;
                    const shapeCol = col - gridCol;
                    const isGhostCell = shapeRow >= 0 && shapeRow < shape.blocks.length &&
                        shapeCol >= 0 && shapeCol < shape.blocks[0].length &&
                        shape.blocks[shapeRow][shapeCol] === 1;
                    if (gameState.grid[row][col] === 0 && !isGhostCell) { isFull = false; break; }
                }
                if (isFull) predictedRows.push(row);
            }
            for (let col = 0; col < GRID_SIZE; col++) {
                let isFull = true;
                for (let row = 0; row < GRID_SIZE; row++) {
                    const shapeRow = row - gridRow;
                    const shapeCol = col - gridCol;
                    const isGhostCell = shapeRow >= 0 && shapeRow < shape.blocks.length &&
                        shapeCol >= 0 && shapeCol < shape.blocks[0].length &&
                        shape.blocks[shapeRow][shapeCol] === 1;
                    if (gameState.grid[row][col] === 0 && !isGhostCell) { isFull = false; break; }
                }
                if (isFull) predictedCols.push(col);
            }
            canvasContext.fillStyle = 'rgba(255, 255, 255, 0.2)';
            predictedRows.forEach(row => canvasContext.fillRect(0, row * CELL_SIZE, GRID_SIZE * CELL_SIZE, CELL_SIZE));
            predictedCols.forEach(col => canvasContext.fillRect(col * CELL_SIZE, 0, CELL_SIZE, GRID_SIZE * CELL_SIZE));
        }
    }
    if (shaken) canvasContext.restore();
    updateAndDrawParticles();
    if (dragState.shapeIndex !== -1 && gameState.availableShapes[dragState.shapeIndex]) {
        const shape = gameState.availableShapes[dragState.shapeIndex];
        canvasContext.save();
        canvasContext.shadowColor = 'rgba(0, 0, 0, 0.55)';
        canvasContext.shadowBlur = 18;
        canvasContext.shadowOffsetX = 4;
        canvasContext.shadowOffsetY = 8;
        drawShape(shape, dragState.pointerX - dragState.offsetX, dragState.pointerY - dragState.offsetY, true, frameTheme);
        canvasContext.restore();
    }
}

function drawShape(shape, x, y, isDragging, frameTheme) {
    const scale = isDragging ? CELL_SIZE : (shape.previewCellSize || SHAPE_PREVIEW_CELL_SIZE);
    for (let row = 0; row < shape.blocks.length; row++) {
        for (let col = 0; col < shape.blocks[row].length; col++) {
            if (shape.blocks[row][col] === 1) {
                drawTile(canvasContext, x + col * scale, y + row * scale, scale, shape.colorId, false, frameTheme);
            }
        }
    }
}

function updateAndDrawParticles() {
    if (particles.length === 0) return;
    canvasContext.save();
    for (let index = particles.length - 1; index >= 0; index--) {
        const particle = particles[index];
        particle.x += particle.velocityX;
        particle.y += particle.velocityY;
        particle.velocityY += particle.gravity;
        particle.alpha -= 0.02;
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
            continue;
        }
        canvasContext.globalAlpha = particle.alpha;
        canvasContext.fillStyle = particle.color;
        canvasContext.fillRect(
            particle.x - particle.size / 2,
            particle.y - particle.size / 2,
            particle.size,
            particle.size
        );
    }
    canvasContext.globalAlpha = 1;
    canvasContext.restore();
}

function requestRedraw() {
    needsRedraw = true;
}

function runRenderLoop() {
    if (gameScreen.classList.contains('active')) {
        const iqMode = gameState.mode === 'iq';
        const dragActive = iqMode ? iqDragActive() : dragState.shapeIndex !== -1;
        const animating = dragActive || particles.length > 0 || shakeFramesRemaining > 0;
        if (needsRedraw || animating) {
            if (iqMode) drawIqGame();
            else drawGame();
            needsRedraw = false;
        }
    }
    requestAnimationFrame(runRenderLoop);
}

function fitBoard() {
    const boardFit = document.getElementById('board-fit');
    if (!boardFit) return;
    boardFit.style.transform = 'none';
    boardFit.style.marginBottom = '0';
    const naturalWidth = boardFit.offsetWidth;
    const naturalHeight = boardFit.offsetHeight;
    if (naturalWidth === 0 || naturalHeight === 0) return;
    const pagePadding = parseFloat(getComputedStyle(gameScreen).paddingLeft) || 18;
    const topbar = document.querySelector('#game-screen .topbar');
    const topbarHeight = topbar ? topbar.offsetHeight : 0;
    const availableWidth = window.innerWidth - pagePadding * 2;
    const availableHeight = window.innerHeight - topbarHeight - 40;
    const scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);
    boardFit.style.transform = `scale(${scale})`;
    boardFit.style.marginBottom = `${-naturalHeight * (1 - scale)}px`;
}

let boardFitQueued = false;

function queueBoardFit() {
    if (boardFitQueued) return;
    boardFitQueued = true;
    requestAnimationFrame(() => {
        boardFitQueued = false;
        fitBoard();
    });
}

window.addEventListener('resize', queueBoardFit);
