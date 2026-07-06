const canvas = document.getElementById('gameCanvas');
const canvasContext = canvas.getContext('2d');

const clipGameOver = new Audio('sounds/gameover.mp3');
const clipLineClear = new Audio('sounds/nocombo.MP3');
const clipComboBig = new Audio('sounds/5x.MP3');
const clipComboEpic = new Audio('sounds/11x.MP3');

const GRID_SIZE = 8;
const LAYOUT_SCALE = 1.5;
const GRID_PIXEL_SIZE = 400 * LAYOUT_SCALE;
const CANVAS_WIDTH = 400 * LAYOUT_SCALE;
const CANVAS_HEIGHT = 600 * LAYOUT_SCALE;
const CELL_SIZE = GRID_PIXEL_SIZE / GRID_SIZE;
const SHAPE_PREVIEW_SCALE = 0.6;
const SHAPE_PREVIEW_CELL_SIZE = CELL_SIZE * SHAPE_PREVIEW_SCALE;
const SHAPE_SLOT_GAP = 14 * LAYOUT_SCALE;
const DRAG_LIFT_OFFSET = 30 * LAYOUT_SCALE;
const LINE_CLEAR_COMMIT_DELAY = 200;

const SHAPE_DEFINITIONS = [
    { blocks: [[1]], colorId: 'green' },
    { blocks: [[1, 1]], colorId: 'blue' },
    { blocks: [[1], [1]], colorId: 'blue' },
    { blocks: [[1, 1, 1]], colorId: 'blue' },
    { blocks: [[1], [1], [1]], colorId: 'blue' },
    { blocks: [[1, 1, 1, 1]], colorId: 'cyan' },
    { blocks: [[1], [1], [1], [1]], colorId: 'cyan' },
    { blocks: [[1, 1, 1, 1, 1]], colorId: 'red' },
    { blocks: [[1], [1], [1], [1], [1]], colorId: 'red' },
    { blocks: [[1, 1], [1, 1]], colorId: 'orange' },
    { blocks: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], colorId: 'purple' },
    { blocks: [[1, 1, 1], [0, 1, 0]], colorId: 'purple' },
    { blocks: [[0, 1, 0], [1, 1, 1]], colorId: 'purple' },
    { blocks: [[1, 0], [1, 1], [1, 0]], colorId: 'purple' },
    { blocks: [[0, 1], [1, 1], [0, 1]], colorId: 'purple' },
    { blocks: [[1, 0], [1, 1]], colorId: 'yellow' },
    { blocks: [[0, 1], [1, 1]], colorId: 'yellow' },
    { blocks: [[1, 1], [1, 0]], colorId: 'yellow' },
    { blocks: [[1, 1], [0, 1]], colorId: 'yellow' },
    { blocks: [[1, 0], [1, 0], [1, 1]], colorId: 'orange' },
    { blocks: [[0, 1], [0, 1], [1, 1]], colorId: 'orange' },
    { blocks: [[1, 1, 1], [1, 0, 0]], colorId: 'orange' },
    { blocks: [[1, 1, 1], [0, 0, 1]], colorId: 'orange' },
    { blocks: [[1, 1, 0], [0, 1, 1]], colorId: 'magenta' },
    { blocks: [[0, 1, 1], [1, 1, 0]], colorId: 'magenta' },
    { blocks: [[0, 1], [1, 1], [1, 0]], colorId: 'magenta' },
    { blocks: [[1, 0], [1, 1], [0, 1]], colorId: 'magenta' },
    { blocks: [[1, 0, 0], [1, 0, 0], [1, 1, 1]], colorId: 'purple' },
    { blocks: [[0, 0, 1], [0, 0, 1], [1, 1, 1]], colorId: 'purple' },
    { blocks: [[1, 1, 1], [1, 0, 0], [1, 0, 0]], colorId: 'purple' },
    { blocks: [[1, 1, 1], [0, 0, 1], [0, 0, 1]], colorId: 'purple' }
];

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

function formatScore(value) {
    return Number(value || 0).toLocaleString('en-US');
}
