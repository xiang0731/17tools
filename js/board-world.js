(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.BoardWorld = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const TILE_SIZE = 1024;
    const MIN_SCALE = 0.5;
    const MAX_SCALE = 3;
    const SCALE_STEP = 0.1;

    function createCamera() {
        return { offsetX: 0, offsetY: 0, scale: 1 };
    }

    function clampScale(scale) {
        const n = Number(scale);
        if (!Number.isFinite(n)) {
            return 1;
        }
        return Math.min(Math.max(n, MIN_SCALE), MAX_SCALE);
    }

    function screenToWorld(screenX, screenY, camera) {
        const scale = camera.scale || 1;
        return {
            x: screenX / scale + camera.offsetX,
            y: screenY / scale + camera.offsetY
        };
    }

    function worldToScreen(worldX, worldY, camera) {
        const scale = camera.scale || 1;
        return {
            x: (worldX - camera.offsetX) * scale,
            y: (worldY - camera.offsetY) * scale
        };
    }

    function panByScreenDelta(camera, dx, dy) {
        const scale = camera.scale || 1;
        return {
            offsetX: camera.offsetX - dx / scale,
            offsetY: camera.offsetY - dy / scale,
            scale: camera.scale
        };
    }

    function worldToTile(worldX, worldY, tileSize) {
        const size = tileSize || TILE_SIZE;
        return {
            tx: Math.floor(worldX / size),
            ty: Math.floor(worldY / size)
        };
    }

    function tileKey(tx, ty) {
        return tx + ',' + ty;
    }

    function parseTileKey(key) {
        const parts = String(key).split(',');
        return { tx: Number(parts[0]), ty: Number(parts[1]) };
    }

    function tileOrigin(tx, ty, tileSize) {
        const size = tileSize || TILE_SIZE;
        return { x: tx * size, y: ty * size };
    }

    function visibleTiles(camera, viewW, viewH, tileSize) {
        const size = tileSize || TILE_SIZE;
        const a = screenToWorld(0, 0, camera);
        const b = screenToWorld(viewW, viewH, camera);
        const minTx = Math.floor(Math.min(a.x, b.x) / size);
        const minTy = Math.floor(Math.min(a.y, b.y) / size);
        const maxTx = Math.floor(Math.max(a.x, b.x) / size);
        const maxTy = Math.floor(Math.max(a.y, b.y) / size);
        const tiles = [];
        for (let ty = minTy; ty <= maxTy; ty++) {
            for (let tx = minTx; tx <= maxTx; tx++) {
                tiles.push({ tx: tx, ty: ty, key: tileKey(tx, ty) });
            }
        }
        return tiles;
    }

    return {
        TILE_SIZE: TILE_SIZE,
        MIN_SCALE: MIN_SCALE,
        MAX_SCALE: MAX_SCALE,
        SCALE_STEP: SCALE_STEP,
        createCamera: createCamera,
        clampScale: clampScale,
        screenToWorld: screenToWorld,
        worldToScreen: worldToScreen,
        panByScreenDelta: panByScreenDelta,
        worldToTile: worldToTile,
        tileKey: tileKey,
        parseTileKey: parseTileKey,
        tileOrigin: tileOrigin,
        visibleTiles: visibleTiles
    };
});
