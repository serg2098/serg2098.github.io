// IQ Blast mode: authentic IQ-Blox style — an orthogonal grid rotated 45°,
// 32 numbered holes in 6 visual rows, ball-and-link pieces, white walls
// between holes. Fixed palette (this mode has no skins).
// Level data comes from js/levels.js (IQ_PIECES, IQ_LEVELS, IQ_TIER_NAMES);
// levels use underlying grid coordinates (u=row, v=col) where adjacency is
// orthogonal in (u,v) but appears diagonal on screen:
//   screenX = BOARD_LEFT + (u+v-2)*HALF,  screenY = BOARD_TOP + (u-v+2)*HALF

const IQ_HALF = 50;                 // half lattice pitch in canvas px
const IQ_BOARD_LEFT = 50;           // screen center of lattice column i=0
const IQ_BOARD_TOP = 92;            // screen center of visual row j=0
const IQ_HOLE_R = 26;
const IQ_BALL_R = 28;
const IQ_LINK_W = 26;
const IQ_DOT_R = 8;
const IQ_TAP_MAX_DISTANCE = 12;
const IQ_TAP_MAX_MS = 350;

const IQ_PANEL = { x: 8, y: 34, w: 584, h: 360, r: 30 };

const IQ_STYLE = {
    panel: '#423bb5',
    panelEdge: '#37319e',
    hole: '#2b2687',
    unusedHole: '#5b54c9',
    dot: '#2b2687',
    number: 'rgba(160, 154, 240, 0.95)',
    wall: '#ffffff',
    wallShadow: 'rgba(20, 16, 80, 0.55)',
    selection: '#f5b942'
};

// Fixed piece colors sampled from the physical game.
const IQ_COLORS = {
    P: '#a8d129', // lime green (swapped with J)
    S: '#9b59d0', // purple
    L: '#f5921e', // orange
    T: '#f06eb7', // pink
    N: '#f5e93d', // yellow
    W: '#e8401c', // red
    J: '#45b7e8'  // sky blue (swapped with P)
};

// Cut links: pairs of orthogonally-adjacent block cells that are drawn/treated as
// NOT joined. The peg still occupies the hole, but no link bar is drawn between the
// pair and a wall may pass between them. The 'P' piece drops its (0,1)-(1,1) link so
// its closed "bowl" opens up and it reads as an F. Kept here (not in the generated
// levels.js) so regenerating levels won't wipe it. Coords are in the piece's base
// orientation; they are rotated/flipped alongside blocks during play.
const IQ_PIECE_CUTS = {
    P: [[[0, 1], [1, 1]]]
};

// Authentic hole layout: 6 visual rows (j), holes at half-steps i; even rows
// i=0,2..10, odd rows i=1,3..9. Hole (0,0) is the unused decorative one.
// Printed numbering 1..32 follows visual rows.
const IQ_VALID = new Set();
const IQ_CELL_NUMBERS = {};
(() => {
    let number = 1;
    for (let j = 0; j < 6; j++) {
        for (let i = j % 2 === 0 ? 0 : 1; i <= 10; i += 2) {
            if (i === 0 && j === 0) continue;
            const u = (i + j) / 2;
            const v = (i - j) / 2 + 2;
            IQ_VALID.add(`${u}:${v}`);
            IQ_CELL_NUMBERS[`${u}:${v}`] = number++;
        }
    }
})();

function iqCellX(u, v) { return IQ_BOARD_LEFT + (u + v - 2) * IQ_HALF; }
function iqCellY(u, v) { return IQ_BOARD_TOP + (u - v + 2) * IQ_HALF; }

const iqLevelScreen = document.getElementById('iq-level-screen');
const iqTierList = document.getElementById('iq-tier-list');
const iqLevelIndicator = document.getElementById('level-indicator');
const levelCompleteModal = document.getElementById('level-complete-modal');
const levelCompleteTitle = document.getElementById('lc-title');
const levelCompleteNext = document.getElementById('lc-next');
const levelCompleteReplay = document.getElementById('lc-replay');
const levelCompleteList = document.getElementById('lc-levels');
const iqRotateButton = document.getElementById('iq-rotate-button');
const iqFlipButton = document.getElementById('iq-flip-button');

const iqState = {
    active: false,
    levelIndex: 0,
    pieces: [],
    wallEdges: new Set(),
    walls: [],
    completed: false,
    selected: -1,
    drag: {
        pieceIndex: -1,
        pointerX: 0,
        pointerY: 0,
        offsetX: 0,
        offsetY: 0,
        startX: 0,
        startY: 0,
        startTime: 0,
        moved: false,
        fromBoard: false
    }
};

let iqProgress = loadSetting('iqProgress', []);
if (!Array.isArray(iqProgress)) iqProgress = [];

// ---------------------------------------------------------------------------
// Piece geometry (must match tools/generate_levels.py transforms)
// ---------------------------------------------------------------------------

function iqRotateBlocks(blocks) {
    const rows = blocks.length;
    const cols = blocks[0].length;
    const out = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            out[c][rows - 1 - r] = blocks[r][c];
        }
    }
    return out;
}

function iqFlipBlocks(blocks) {
    return blocks.map(row => [...row].reverse());
}

// Cut edges are pairs of block cells; they must transform in lockstep with blocks.
function iqRotateCell([r, c], rows) { return [c, rows - 1 - r]; }
function iqFlipCell([r, c], cols) { return [r, cols - 1 - c]; }

function iqIsCut(cuts, r1, c1, r2, c2) {
    return cuts.some(([a, b]) =>
        (a[0] === r1 && a[1] === c1 && b[0] === r2 && b[1] === c2) ||
        (a[0] === r2 && a[1] === c2 && b[0] === r1 && b[1] === c1));
}

// Orient cut edges the same way iqOrientedBlocks orients blocks: flip first, then
// rotate rot times. rows/cols are the piece's base (pre-transform) dimensions.
function iqOrientedCuts(cuts, rows, cols, rot, flip) {
    let out = cuts.map(pair => pair.map(cell => [...cell]));
    let r = rows, c = cols;
    if (flip) out = out.map(pair => pair.map(cell => iqFlipCell(cell, c)));
    for (let i = 0; i < rot; i++) {
        out = out.map(pair => pair.map(cell => iqRotateCell(cell, r)));
        [r, c] = [c, r];
    }
    return out;
}

function iqOrientedBlocks(pieceIndex, rot, flip) {
    let blocks = IQ_PIECES[pieceIndex].blocks.map(row => [...row]);
    if (flip) blocks = iqFlipBlocks(blocks);
    for (let i = 0; i < rot; i++) blocks = iqRotateBlocks(blocks);
    return blocks;
}

function iqPieceCells(blocks) {
    const cells = [];
    for (let r = 0; r < blocks.length; r++) {
        for (let c = 0; c < blocks[r].length; c++) {
            if (blocks[r][c] === 1) cells.push({ dr: r, dc: c });
        }
    }
    return cells;
}

// Screen offset of a block cell relative to the origin cell, at a given scale.
function iqLocalPos(dr, dc, half) {
    return { x: (dr + dc) * half, y: (dr - dc) * half };
}

// ---------------------------------------------------------------------------
// Tray layout: pieces 0-3 in the top row, 4-6 in the bottom row.
// ---------------------------------------------------------------------------

const IQ_TRAY_HALF = 28;
const IQ_TRAY_BALL_R = 16;
const IQ_TRAY_LINK_W = 15;
const IQ_TRAY_ROWS = [
    { cy: 525, slots: 4 },
    { cy: 760, slots: 3 }
];

function iqTraySlotCenter(pieceIndex) {
    const rowIndex = pieceIndex < 4 ? 0 : 1;
    const row = IQ_TRAY_ROWS[rowIndex];
    const slotIndex = pieceIndex - (rowIndex === 0 ? 0 : 4);
    const slotWidth = canvas.width / row.slots;
    return { cx: slotIndex * slotWidth + slotWidth / 2, cy: row.cy };
}

function iqLayoutTrayPiece(piece) {
    const { cx, cy } = iqTraySlotCenter(piece.index);
    const cells = iqPieceCells(piece.blocks);
    const positions = cells.map(cell => iqLocalPos(cell.dr, cell.dc, IQ_TRAY_HALF));
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y));
    piece.trayOriginX = cx - (minX + maxX) / 2;
    piece.trayOriginY = cy - (minY + maxY) / 2;
    piece.trayBox = {
        x: piece.trayOriginX + minX - IQ_TRAY_BALL_R,
        y: piece.trayOriginY + minY - IQ_TRAY_BALL_R,
        w: maxX - minX + IQ_TRAY_BALL_R * 2,
        h: maxY - minY + IQ_TRAY_BALL_R * 2
    };
}

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

// Edge keys: 'h:u:v' = edge between (u,v)-(u,v+1); 'v:u:v' = edge between (u,v)-(u+1,v).
function iqWallEdgeKeys(u, v, open) {
    const sides = {
        u: `v:${u - 1}:${v}`,
        d: `v:${u}:${v}`,
        l: `h:${u}:${v - 1}`,
        r: `h:${u}:${v}`
    };
    return ['u', 'r', 'd', 'l'].filter(dir => dir !== open).map(dir => sides[dir]);
}

// ---------------------------------------------------------------------------
// Level lifecycle
// ---------------------------------------------------------------------------

function iqLoadLevel(levelIndex) {
    const level = IQ_LEVELS[levelIndex];
    iqState.levelIndex = levelIndex;
    iqState.completed = false;
    iqState.drag.pieceIndex = -1;
    iqState.walls = level.w.map(([u, v, open]) => ({ u, v, open }));
    iqState.wallEdges = new Set();
    for (const wall of iqState.walls) {
        for (const key of iqWallEdgeKeys(wall.u, wall.v, wall.open)) {
            iqState.wallEdges.add(key);
        }
    }
    iqState.pieces = IQ_PIECES.map((definition, index) => ({
        index,
        id: definition.id,
        color: IQ_COLORS[definition.id],
        blocks: definition.blocks.map(row => [...row]),
        cuts: (IQ_PIECE_CUTS[definition.id] || []).map(pair => pair.map(cell => [...cell])),
        placed: null,
        trayOriginX: 0,
        trayOriginY: 0,
        trayBox: null
    }));
    for (const [pieceIndex, u, v, rot, flip] of level.s) {
        const piece = iqState.pieces[pieceIndex];
        const base = IQ_PIECES[pieceIndex];
        piece.blocks = iqOrientedBlocks(pieceIndex, rot, flip);
        piece.cuts = iqOrientedCuts(
            IQ_PIECE_CUTS[base.id] || [], base.blocks.length, base.blocks[0].length, rot, flip);
        piece.placed = { u, v };
    }
    iqState.pieces.forEach(iqLayoutTrayPiece);
    iqSelectNextUnplaced();
    if (iqLevelIndicator) {
        iqLevelIndicator.innerHTML =
            `Level ${levelIndex + 1} <span class="level-tier">${IQ_TIER_NAMES[level.t]}</span>`;
    }
    requestRedraw();
}

function iqSelectNextUnplaced() {
    const next = iqState.pieces.find(p => !p.placed);
    iqState.selected = next ? next.index : -1;
}

function iqOwnerAt(u, v) {
    for (const piece of iqState.pieces) {
        if (!piece.placed) continue;
        const r = u - piece.placed.u;
        const c = v - piece.placed.v;
        if (r >= 0 && r < piece.blocks.length && c >= 0 && c < piece.blocks[0].length &&
            piece.blocks[r][c] === 1) {
            return piece;
        }
    }
    return null;
}

function iqCanPlace(piece, gridU, gridV) {
    const blocks = piece.blocks;
    for (let r = 0; r < blocks.length; r++) {
        for (let c = 0; c < blocks[r].length; c++) {
            if (blocks[r][c] !== 1) continue;
            const u = gridU + r;
            const v = gridV + c;
            if (!IQ_VALID.has(`${u}:${v}`)) return false;
            const owner = iqOwnerAt(u, v);
            if (owner && owner !== piece) return false;
            const cuts = piece.cuts || [];
            // A wall only blocks when it sits between two *linked* pegs; a cut edge
            // lets the wall pass between them.
            if (c + 1 < blocks[r].length && blocks[r][c + 1] === 1 &&
                iqState.wallEdges.has(`h:${u}:${v}`) &&
                !iqIsCut(cuts, r, c, r, c + 1)) return false;
            if (r + 1 < blocks.length && blocks[r + 1][c] === 1 &&
                iqState.wallEdges.has(`v:${u}:${v}`) &&
                !iqIsCut(cuts, r, c, r + 1, c)) return false;
        }
    }
    return true;
}

function iqCheckWin() {
    if (!iqState.pieces.every(piece => piece.placed)) return;
    iqState.completed = true;
    iqState.selected = -1;
    gameState.isRunning = false;
    if (!iqProgress.includes(iqState.levelIndex)) {
        iqProgress.push(iqState.levelIndex);
        saveSetting('iqProgress', iqProgress);
    }
    playLineClearCue(5);
    iqCelebrate();
    setTimeout(() => {
        if (!iqState.active) return;
        levelCompleteTitle.textContent = `Level ${iqState.levelIndex + 1} solved!`;
        levelCompleteNext.style.display =
            iqState.levelIndex + 1 < IQ_LEVELS.length ? '' : 'none';
        openModal(levelCompleteModal);
    }, 900);
}

function iqCelebrate() {
    for (const piece of iqState.pieces) {
        if (!piece.placed) continue;
        for (const cell of iqPieceCells(piece.blocks)) {
            const u = piece.placed.u + cell.dr;
            const v = piece.placed.v + cell.dc;
            for (let i = 0; i < 5; i++) {
                particles.push({
                    x: iqCellX(u, v),
                    y: iqCellY(u, v),
                    velocityX: Math.random() * 8 - 4,
                    velocityY: -7 + Math.random() * 5,
                    size: 3 + Math.random() * 6,
                    color: piece.color,
                    alpha: 1,
                    gravity: 0.22
                });
            }
        }
    }
    requestRedraw();
}

// ---------------------------------------------------------------------------
// Rotate / flip controls (R and F keys, or the on-screen buttons)
// ---------------------------------------------------------------------------

function iqActionTarget() {
    if (!iqState.active || iqState.completed || !gameState.isRunning) return null;
    if (iqState.drag.pieceIndex !== -1) return iqState.pieces[iqState.drag.pieceIndex];
    if (iqState.selected !== -1) {
        const piece = iqState.pieces[iqState.selected];
        if (piece && !piece.placed) return piece;
    }
    return null;
}

function iqAfterReorient(piece) {
    if (iqState.drag.pieceIndex === piece.index) {
        // Keep the dragged piece centered under the pointer.
        const positions = iqPieceCells(piece.blocks)
            .map(cell => iqLocalPos(cell.dr, cell.dc, IQ_HALF));
        const minX = Math.min(...positions.map(p => p.x));
        const maxX = Math.max(...positions.map(p => p.x));
        const minY = Math.min(...positions.map(p => p.y));
        const maxY = Math.max(...positions.map(p => p.y));
        iqState.drag.offsetX = (minX + maxX) / 2;
        iqState.drag.offsetY = (minY + maxY) / 2 + DRAG_LIFT_OFFSET;
    } else {
        iqLayoutTrayPiece(piece);
    }
    playPickupSound();
    requestRedraw();
}

function iqRotateSelected() {
    const piece = iqActionTarget();
    if (!piece) return;
    const rows = piece.blocks.length;
    piece.blocks = iqRotateBlocks(piece.blocks);
    piece.cuts = piece.cuts.map(pair => pair.map(cell => iqRotateCell(cell, rows)));
    iqAfterReorient(piece);
}

function iqFlipSelected() {
    const piece = iqActionTarget();
    if (!piece) return;
    const cols = piece.blocks[0].length;
    piece.blocks = iqFlipBlocks(piece.blocks);
    piece.cuts = piece.cuts.map(pair => pair.map(cell => iqFlipCell(cell, cols)));
    iqAfterReorient(piece);
}

window.addEventListener('keydown', event => {
    if (gameState.mode !== 'iq' || !gameScreen.classList.contains('active')) return;
    if (event.repeat) return;
    // Match by physical key position (event.code) so rotate/flip work on any
    // keyboard layout — on Ukrainian/Russian/etc. the R/F keys emit different
    // letters, but the code (KeyR/KeyF) stays the same. Keep the letter check as
    // a fallback for the rare browser without event.code.
    const code = event.code;
    const key = event.key.toLowerCase();
    if (code === 'KeyR' || key === 'r') iqRotateSelected();
    else if (code === 'KeyF' || key === 'f') iqFlipSelected();
});

// ---------------------------------------------------------------------------
// Input (called from input.js when gameState.mode === 'iq')
// ---------------------------------------------------------------------------

function iqSnapOrigin(originX, originY) {
    const uReal = ((originX - IQ_BOARD_LEFT) + (originY - IQ_BOARD_TOP)) / (IQ_HALF * 2);
    const vReal = ((originX - IQ_BOARD_LEFT) - (originY - IQ_BOARD_TOP)) / (IQ_HALF * 2) + 2;
    return { u: Math.round(uReal), v: Math.round(vReal) };
}

function iqCellFromPoint(x, y) {
    // Nearest lattice cell (may be invalid); used to detect taps on placed pieces.
    const snap = iqSnapOrigin(x, y);
    const dx = x - iqCellX(snap.u, snap.v);
    const dy = y - iqCellY(snap.u, snap.v);
    if (dx * dx + dy * dy > (IQ_HALF * 0.75) ** 2) return null;
    return snap;
}

function iqPointerDown(clientX, clientY) {
    if (!gameState.isRunning || iqState.completed) return;
    const point = getCanvasPoint(clientX, clientY);
    const drag = iqState.drag;

    // Placed piece on the board? Lift it off.
    const cell = iqCellFromPoint(point.x, point.y);
    if (cell) {
        const owner = iqOwnerAt(cell.u, cell.v);
        if (owner) {
            const originX = iqCellX(owner.placed.u, owner.placed.v);
            const originY = iqCellY(owner.placed.u, owner.placed.v);
            owner.placed = null;
            iqState.selected = owner.index;
            drag.pieceIndex = owner.index;
            drag.pointerX = point.x;
            drag.pointerY = point.y;
            drag.offsetX = point.x - originX;
            drag.offsetY = point.y - originY + DRAG_LIFT_OFFSET;
            drag.startX = point.x;
            drag.startY = point.y;
            drag.startTime = performance.now();
            drag.moved = false;
            drag.fromBoard = true;
            playPickupSound();
            requestRedraw();
            return;
        }
    }

    // Tray piece?
    for (const piece of iqState.pieces) {
        if (piece.placed) continue;
        const box = piece.trayBox;
        const pad = 10;
        if (point.x >= box.x - pad && point.x <= box.x + box.w + pad &&
            point.y >= box.y - pad && point.y <= box.y + box.h + pad) {
            iqState.selected = piece.index;
            const positions = iqPieceCells(piece.blocks)
                .map(c => iqLocalPos(c.dr, c.dc, IQ_HALF));
            const minX = Math.min(...positions.map(p => p.x));
            const maxX = Math.max(...positions.map(p => p.x));
            const minY = Math.min(...positions.map(p => p.y));
            const maxY = Math.max(...positions.map(p => p.y));
            drag.pieceIndex = piece.index;
            drag.pointerX = point.x;
            drag.pointerY = point.y;
            drag.offsetX = (minX + maxX) / 2;
            drag.offsetY = (minY + maxY) / 2 + DRAG_LIFT_OFFSET;
            drag.startX = point.x;
            drag.startY = point.y;
            drag.startTime = performance.now();
            drag.moved = false;
            drag.fromBoard = false;
            playPickupSound();
            requestRedraw();
            return;
        }
    }
}

function iqPointerMove(clientX, clientY) {
    const drag = iqState.drag;
    if (drag.pieceIndex === -1) return;
    const point = getCanvasPoint(clientX, clientY);
    drag.pointerX = point.x;
    drag.pointerY = point.y;
    if (Math.hypot(point.x - drag.startX, point.y - drag.startY) > IQ_TAP_MAX_DISTANCE) {
        drag.moved = true;
    }
    requestRedraw();
}

function iqPointerUp(clientX, clientY) {
    const drag = iqState.drag;
    if (drag.pieceIndex === -1) return;
    iqPointerMove(clientX, clientY);
    const piece = iqState.pieces[drag.pieceIndex];
    const elapsed = performance.now() - drag.startTime;
    drag.pieceIndex = -1;

    // A tap on a tray piece just selects it (rotation is R / the buttons).
    if (!drag.moved && elapsed < IQ_TAP_MAX_MS && !drag.fromBoard) {
        requestRedraw();
        return;
    }

    const originX = drag.pointerX - drag.offsetX;
    const originY = drag.pointerY - drag.offsetY;
    const snap = iqSnapOrigin(originX, originY);
    if (iqCanPlace(piece, snap.u, snap.v)) {
        piece.placed = { u: snap.u, v: snap.v };
        playPlaceSound();
        if (iqState.selected === piece.index) iqSelectNextUnplaced();
        iqCheckWin();
    } else {
        const overBoard = drag.pointerY < IQ_PANEL.y + IQ_PANEL.h + IQ_HALF;
        if (overBoard && drag.moved) triggerInvalidPlacementFeedback();
    }
    requestRedraw();
}

function iqDragActive() {
    return iqState.active && iqState.drag.pieceIndex !== -1;
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

// Soft drop shadow under a piece: an opaque dark blob per ball, offset down and
// blurred, so it peeks out below the (opaque) peg and lifts it off the board.
function iqDrawPieceShadow(context, originX, originY, blocks, half, ballR, offsetY, blur, alpha) {
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = 'rgb(18, 14, 58)';
    context.shadowColor = 'rgb(18, 14, 58)';
    context.shadowBlur = blur;
    context.shadowOffsetY = offsetY;
    for (const cell of iqPieceCells(blocks)) {
        const p = iqLocalPos(cell.dr, cell.dc, half);
        context.beginPath();
        context.arc(originX + p.x, originY + p.y, ballR, 0, Math.PI * 2);
        context.fill();
    }
    context.restore();
}

function iqDrawPiece(context, originX, originY, blocks, half, ballR, linkW, color, cuts = []) {
    const cells = iqPieceCells(blocks);
    // Links first, so the glossy balls sit on top. Cut edges are skipped.
    context.strokeStyle = color;
    context.lineWidth = linkW;
    context.lineCap = 'round';
    for (const cell of cells) {
        const a = iqLocalPos(cell.dr, cell.dc, half);
        if (cell.dc + 1 < blocks[cell.dr].length && blocks[cell.dr][cell.dc + 1] === 1 &&
            !iqIsCut(cuts, cell.dr, cell.dc, cell.dr, cell.dc + 1)) {
            const b = iqLocalPos(cell.dr, cell.dc + 1, half);
            context.beginPath();
            context.moveTo(originX + a.x, originY + a.y);
            context.lineTo(originX + b.x, originY + b.y);
            context.stroke();
        }
        if (cell.dr + 1 < blocks.length && blocks[cell.dr + 1][cell.dc] === 1 &&
            !iqIsCut(cuts, cell.dr, cell.dc, cell.dr + 1, cell.dc)) {
            const b = iqLocalPos(cell.dr + 1, cell.dc, half);
            context.beginPath();
            context.moveTo(originX + a.x, originY + a.y);
            context.lineTo(originX + b.x, originY + b.y);
            context.stroke();
        }
    }
    // Glossy plastic pegs: base fill + up-left highlight gradient, specular dot,
    // and a subtle darker lower rim.
    const highlight = lightenHex(color, 65);
    const rimWidth = Math.max(1, ballR * 0.09);
    for (const cell of cells) {
        const p = iqLocalPos(cell.dr, cell.dc, half);
        const cx = originX + p.x;
        const cy = originY + p.y;
        context.fillStyle = color;
        context.beginPath();
        context.arc(cx, cy, ballR, 0, Math.PI * 2);
        context.fill();
        const gradient = context.createRadialGradient(
            cx - ballR * 0.35, cy - ballR * 0.4, ballR * 0.1,
            cx, cy, ballR
        );
        gradient.addColorStop(0, highlight);
        gradient.addColorStop(0.5, color);
        gradient.addColorStop(1, color);
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(cx, cy, ballR, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(255, 255, 255, 0.55)';
        context.beginPath();
        context.arc(cx - ballR * 0.32, cy - ballR * 0.36, ballR * 0.22, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = 'rgba(0, 0, 0, 0.16)';
        context.lineWidth = rimWidth;
        context.beginPath();
        context.arc(cx, cy, ballR - rimWidth / 2, Math.PI * 0.15, Math.PI * 0.85);
        context.stroke();
    }
}

function drawIqBoard(context) {
    // Panel
    context.fillStyle = IQ_STYLE.panel;
    context.strokeStyle = IQ_STYLE.panelEdge;
    context.lineWidth = 4;
    context.beginPath();
    context.roundRect(IQ_PANEL.x, IQ_PANEL.y, IQ_PANEL.w, IQ_PANEL.h, IQ_PANEL.r);
    context.fill();
    context.stroke();

    // Small lattice dots (positions between the holes)
    context.fillStyle = IQ_STYLE.dot;
    for (let j = 0; j <= 5; j++) {
        for (let i = 0; i <= 10; i++) {
            if ((i + j) % 2 === 0) continue;
            context.beginPath();
            context.arc(IQ_BOARD_LEFT + i * IQ_HALF, IQ_BOARD_TOP + j * IQ_HALF, IQ_DOT_R, 0, Math.PI * 2);
            context.fill();
        }
    }

    // Unused decorative hole (top-left)
    context.fillStyle = IQ_STYLE.unusedHole;
    context.beginPath();
    context.arc(IQ_BOARD_LEFT, IQ_BOARD_TOP, IQ_HOLE_R, 0, Math.PI * 2);
    context.fill();

    // Holes with printed numbers
    context.font = '700 19px "Baloo 2", sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (const key of IQ_VALID) {
        const [u, v] = key.split(':').map(Number);
        const x = iqCellX(u, v);
        const y = iqCellY(u, v);
        context.fillStyle = IQ_STYLE.hole;
        context.beginPath();
        context.arc(x, y, IQ_HOLE_R, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = IQ_STYLE.number;
        context.fillText(String(IQ_CELL_NUMBERS[key]), x, y + 1);
    }
}

function drawIqWalls(context) {
    context.save();
    context.lineCap = 'round';
    for (const wall of iqState.walls) {
        for (const key of iqWallEdgeKeys(wall.u, wall.v, wall.open)) {
            const [kind, us, vs] = key.split(':');
            const u = Number(us);
            const v = Number(vs);
            // Edge midpoint and the perpendicular direction of the wall bar.
            let mx, my, px, py;
            if (kind === 'h') {
                // (u,v)-(u,v+1): neighbor is up-right on screen; bar runs down-right.
                mx = iqCellX(u, v) + IQ_HALF / 2;
                my = iqCellY(u, v) - IQ_HALF / 2;
                px = Math.SQRT1_2; py = Math.SQRT1_2;
            } else {
                // (u,v)-(u+1,v): neighbor is down-right on screen; bar runs up-right.
                mx = iqCellX(u, v) + IQ_HALF / 2;
                my = iqCellY(u, v) + IQ_HALF / 2;
                px = Math.SQRT1_2; py = -Math.SQRT1_2;
            }
            const len = IQ_HALF * 0.62;
            const x1 = mx - px * len;
            const y1 = my - py * len;
            const x2 = mx + px * len;
            const y2 = my + py * len;
            // Perpendicular, oriented "up" so the gloss line sits on the top edge.
            let nx = -py;
            let ny = px;
            if (ny > 0) { nx = -nx; ny = -ny; }
            const bar = (dx, dy, width, style) => {
                context.strokeStyle = style;
                context.lineWidth = width;
                context.beginPath();
                context.moveTo(x1 + dx, y1 + dy);
                context.lineTo(x2 + dx, y2 + dy);
                context.stroke();
            };
            bar(0, 3, 16, 'rgba(22, 17, 66, 0.38)');   // crisp drop shadow
            bar(0, 0, 14, '#eef0fb');                   // soft-white bar
            bar(nx * 3, ny * 3, 4, 'rgba(255, 255, 255, 0.92)'); // top gloss
        }
    }
    context.restore();
}

function drawIqGame() {
    const context = canvasContext;
    context.clearRect(0, 0, canvas.width, canvas.height);
    let shaken = false;
    if (shakeFramesRemaining > 0) {
        const offsetX = (Math.random() - 0.5) * shakeStrength;
        const offsetY = (Math.random() - 0.5) * shakeStrength;
        context.save();
        context.translate(offsetX, offsetY);
        shakeFramesRemaining--;
        shakeStrength *= 0.92;
        shaken = true;
    }

    drawIqBoard(context);

    // Placed pieces (soft shadow first, so they lift off the board)
    for (const piece of iqState.pieces) {
        if (!piece.placed || piece.index === iqState.drag.pieceIndex) continue;
        const px = iqCellX(piece.placed.u, piece.placed.v);
        const py = iqCellY(piece.placed.u, piece.placed.v);
        iqDrawPieceShadow(context, px, py, piece.blocks, IQ_HALF, IQ_BALL_R, 4, 8, 0.32);
        iqDrawPiece(context, px, py, piece.blocks, IQ_HALF, IQ_BALL_R, IQ_LINK_W, piece.color, piece.cuts);
    }

    // Ghost preview while dragging
    if (iqState.drag.pieceIndex !== -1) {
        const piece = iqState.pieces[iqState.drag.pieceIndex];
        const snap = iqSnapOrigin(
            iqState.drag.pointerX - iqState.drag.offsetX,
            iqState.drag.pointerY - iqState.drag.offsetY
        );
        if (iqCanPlace(piece, snap.u, snap.v)) {
            context.save();
            context.globalAlpha = 0.45;
            iqDrawPiece(
                context,
                iqCellX(snap.u, snap.v), iqCellY(snap.u, snap.v),
                piece.blocks, IQ_HALF, IQ_BALL_R, IQ_LINK_W, piece.color, piece.cuts
            );
            context.restore();
        }
    }

    drawIqWalls(context);
    if (shaken) context.restore();

    // Tray pieces
    for (const piece of iqState.pieces) {
        if (piece.placed || piece.index === iqState.drag.pieceIndex) continue;
        if (piece.index === iqState.selected) {
            const box = piece.trayBox;
            context.save();
            context.strokeStyle = IQ_STYLE.selection;
            context.lineWidth = 3.5;
            context.shadowColor = IQ_STYLE.selection;
            context.shadowBlur = 10;
            context.beginPath();
            context.roundRect(box.x - 12, box.y - 12, box.w + 24, box.h + 24, 18);
            context.stroke();
            context.restore();
        }
        iqDrawPiece(
            context, piece.trayOriginX, piece.trayOriginY,
            piece.blocks, IQ_TRAY_HALF, IQ_TRAY_BALL_R, IQ_TRAY_LINK_W, piece.color, piece.cuts
        );
    }

    updateAndDrawParticles();

    // Dragged piece on top (stronger lifted shadow)
    if (iqState.drag.pieceIndex !== -1) {
        const piece = iqState.pieces[iqState.drag.pieceIndex];
        const dragX = iqState.drag.pointerX - iqState.drag.offsetX;
        const dragY = iqState.drag.pointerY - iqState.drag.offsetY;
        iqDrawPieceShadow(context, dragX, dragY, piece.blocks, IQ_HALF, IQ_BALL_R, 8, 16, 0.4);
        iqDrawPiece(
            context,
            dragX,
            dragY,
            piece.blocks, IQ_HALF, IQ_BALL_R, IQ_LINK_W, piece.color, piece.cuts
        );
    }
}

// ---------------------------------------------------------------------------
// Screens & navigation
// ---------------------------------------------------------------------------

function iqSwitchScreen(fromScreen, toScreen, afterShow) {
    fromScreen.classList.remove('active');
    setTimeout(() => {
        fromScreen.style.display = 'none';
        toScreen.style.display = 'flex';
        setTimeout(() => {
            toScreen.classList.add('active');
            if (afterShow) afterShow();
        }, 50);
    }, 500);
}

function iqBuildLevelList() {
    iqTierList.innerHTML = '';
    IQ_TIER_NAMES.forEach((tierName, tierIndex) => {
        const first = IQ_LEVELS.findIndex(level => level.t === tierIndex);
        if (first === -1) return;
        const count = IQ_LEVELS.filter(level => level.t === tierIndex).length;
        const heading = document.createElement('div');
        heading.className = 'iq-tier-heading';
        heading.innerHTML = `<span>${tierName}</span><span class="iq-tier-range">${first + 1}–${first + count}</span>`;
        iqTierList.appendChild(heading);
        const grid = document.createElement('div');
        grid.className = 'iq-level-grid';
        for (let i = first; i < first + count; i++) {
            const tile = document.createElement('button');
            tile.className = 'iq-level-tile';
            tile.dataset.level = i;
            if (iqProgress.includes(i)) tile.classList.add('done');
            tile.innerHTML = `<span class="iq-level-num">${i + 1}</span><span class="iq-level-star">★</span>`;
            tile.addEventListener('click', () => iqEnterLevel(i));
            grid.appendChild(tile);
        }
        iqTierList.appendChild(grid);
    });
}

function iqOpenLevelSelect(fromScreen) {
    iqBuildLevelList();
    iqSwitchScreen(fromScreen, iqLevelScreen);
}

function iqEnterLevel(levelIndex) {
    iqState.active = true;
    gameState.mode = 'iq';
    gameState.isRunning = true;
    gameState.turnToken++;
    gameScreen.classList.add('iq-mode');
    iqLoadLevel(levelIndex);
    iqSwitchScreen(iqLevelScreen, gameScreen, () => {
        fitBoard();
        syncBackgroundMusic();
    });
    if (!renderLoopStarted) {
        renderLoopStarted = true;
        requestAnimationFrame(runRenderLoop);
    }
    requestRedraw();
}

function iqTeardown() {
    iqState.active = false;
    iqState.drag.pieceIndex = -1;
    gameState.mode = 'classic';
    gameScreen.classList.remove('iq-mode');
}

function iqExitToLevelSelect() {
    iqState.active = false;
    iqState.drag.pieceIndex = -1;
    gameState.isRunning = false;
    stopBackgroundMusic();
    iqBuildLevelList();
    gameScreen.classList.remove('iq-mode');
    gameState.mode = 'classic';
    iqSwitchScreen(gameScreen, iqLevelScreen);
}

function iqRestartLevel() {
    gameState.isRunning = true;
    iqLoadLevel(iqState.levelIndex);
}

// Menu button + modal + control buttons wiring.
document.getElementById('iq-blast-button').addEventListener('click', () => {
    iqOpenLevelSelect(mainMenu);
});

document.getElementById('iq-levels-back').addEventListener('click', () => {
    iqSwitchScreen(iqLevelScreen, mainMenu);
});

iqRotateButton.addEventListener('click', iqRotateSelected);
iqFlipButton.addEventListener('click', iqFlipSelected);

levelCompleteNext.addEventListener('click', () => {
    closeModal(levelCompleteModal, () => {
        gameState.isRunning = true;
        iqLoadLevel(iqState.levelIndex + 1);
    });
});

levelCompleteReplay.addEventListener('click', () => {
    closeModal(levelCompleteModal, iqRestartLevel);
});

levelCompleteList.addEventListener('click', () => {
    closeModal(levelCompleteModal, iqExitToLevelSelect);
});
