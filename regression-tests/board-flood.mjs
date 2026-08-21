import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BoardFlood = require('../js/board-flood.js');

function makeGrid(width, height, fill) {
    const pixels = [];
    for (let y = 0; y < height; y++) {
        const row = [];
        for (let x = 0; x < width; x++) {
            row.push({ r: fill.r, g: fill.g, b: fill.b, a: fill.a });
        }
        pixels.push(row);
    }
    return { width, height, pixels };
}

function ink(r, g, b, a) {
    return { r, g, b, a };
}

function getPixel(grid, x, y) {
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) {
        return null;
    }
    const pixel = grid.pixels[y][x];
    return { r: pixel.r, g: pixel.g, b: pixel.b, a: pixel.a };
}

function clearPixel(grid, x, y) {
    grid.pixels[y][x] = { r: 0, g: 0, b: 0, a: 0 };
}

function countInk(grid) {
    let count = 0;
    for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
            if (grid.pixels[y][x].a > 0) {
                count++;
            }
        }
    }
    return count;
}

function setPixel(grid, x, y, color) {
    grid.pixels[y][x] = { r: color.r, g: color.g, b: color.b, a: color.a };
}

const black = ink(0, 0, 0, 255);
const red = ink(255, 0, 0, 255);
const transparent = ink(0, 0, 0, 0);

const cross = makeGrid(9, 9, transparent);
for (let i = 0; i < 9; i++) {
    setPixel(cross, 4, i, black);
    setPixel(cross, i, 4, black);
}
const crossInkBefore = countInk(cross);
assert.equal(crossInkBefore, 17);
const crossCleared = BoardFlood.floodClear(4, 4, (x, y) => getPixel(cross, x, y), (x, y) => clearPixel(cross, x, y));
assert.equal(crossCleared, 17);
assert.equal(countInk(cross), 0);

const adjacent = makeGrid(6, 2, transparent);
for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 3; x++) {
        setPixel(adjacent, x, y, red);
        setPixel(adjacent, x + 3, y, black);
    }
}
const redCleared = BoardFlood.floodClear(1, 0, (x, y) => getPixel(adjacent, x, y), (x, y) => clearPixel(adjacent, x, y));
assert.equal(redCleared, 6);
for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 3; x++) {
        assert.equal(adjacent.pixels[y][x].a, 0);
        assert.equal(adjacent.pixels[y][x + 3].a, 255);
        assert.equal(adjacent.pixels[y][x + 3].r, 0);
    }
}

const empty = makeGrid(4, 4, transparent);
const snapshot = JSON.stringify(empty.pixels);
const emptyCleared = BoardFlood.floodClear(1, 1, (x, y) => getPixel(empty, x, y), (x, y) => clearPixel(empty, x, y));
assert.equal(emptyCleared, 0);
assert.equal(JSON.stringify(empty.pixels), snapshot);

console.log('board-flood regression passed');
