import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BoardWorld = require('../js/board-world.js');

assert.equal(BoardWorld.TILE_SIZE, 1024);
assert.equal(BoardWorld.MIN_SCALE, 0.5);
assert.equal(BoardWorld.MAX_SCALE, 3);
assert.equal(BoardWorld.SCALE_STEP, 0.1);

const origin = BoardWorld.createCamera();
assert.deepEqual(origin, { offsetX: 0, offsetY: 0, scale: 1 });

assert.deepEqual(
    BoardWorld.screenToWorld(0, 0, origin),
    { x: 0, y: 0 }
);
assert.deepEqual(
    BoardWorld.worldToScreen(0, 0, origin),
    { x: 0, y: 0 }
);

const zoomed = { offsetX: 10, offsetY: 20, scale: 2 };
assert.deepEqual(BoardWorld.screenToWorld(10, 10, zoomed), { x: 15, y: 25 });
assert.deepEqual(BoardWorld.worldToScreen(15, 25, zoomed), { x: 10, y: 10 });

const panned = BoardWorld.panByScreenDelta(zoomed, 10, 0);
assert.equal(panned.offsetX, 5);
assert.equal(panned.offsetY, 20);
assert.equal(panned.scale, 2);
assert.equal(zoomed.offsetX, 10);

assert.equal(BoardWorld.clampScale(0.1), 0.5);
assert.equal(BoardWorld.clampScale(9), 3);
assert.equal(BoardWorld.clampScale(1.2), 1.2);

assert.deepEqual(BoardWorld.worldToTile(-1, -1), { tx: -1, ty: -1 });
assert.deepEqual(BoardWorld.worldToTile(0, 0), { tx: 0, ty: 0 });
assert.deepEqual(BoardWorld.worldToTile(1023, 1023), { tx: 0, ty: 0 });
assert.deepEqual(BoardWorld.worldToTile(1024, 1024), { tx: 1, ty: 1 });

assert.equal(BoardWorld.tileKey(-1, 2), '-1,2');
assert.deepEqual(BoardWorld.parseTileKey('-1,2'), { tx: -1, ty: 2 });
assert.deepEqual(BoardWorld.tileOrigin(-1, 2), { x: -1024, y: 2048 });

const vis0 = BoardWorld.visibleTiles(origin, 800, 600);
assert.equal(vis0.some((t) => t.key === '0,0'), true);
assert.equal(vis0.some((t) => t.key === '-1,-1'), false);

const visPan = BoardWorld.visibleTiles(
    { offsetX: -100, offsetY: -100, scale: 1 },
    800,
    600
);
assert.equal(visPan.some((t) => t.key === '0,0'), true);
assert.equal(visPan.some((t) => t.key === '-1,-1'), true);

console.log('board-world regression passed');
