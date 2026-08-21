(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.BoardFlood = factory();
    }
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    const SEED_ALPHA_MIN = 20;
    const NEIGHBOR_ALPHA_MIN = 8;
    const COLOR_TOLERANCE = 48;

    const NEIGHBORS = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0],           [1, 0],
        [-1, 1],  [0, 1],  [1, 1]
    ];

    function colorMatches(seed, pixel) {
        return Math.abs(seed.r - pixel.r) <= COLOR_TOLERANCE
            && Math.abs(seed.g - pixel.g) <= COLOR_TOLERANCE
            && Math.abs(seed.b - pixel.b) <= COLOR_TOLERANCE;
    }

    function pixelKey(x, y) {
        return x + ',' + y;
    }

    function floodClear(x, y, getPixel, clearPixel) {
        const seed = getPixel(x, y);
        if (!seed || seed.a < SEED_ALPHA_MIN) {
            return 0;
        }

        const seen = Object.create(null);
        const queue = [x, y];
        seen[pixelKey(x, y)] = 1;
        let cleared = 0;
        let head = 0;

        while (head < queue.length) {
            const cx = queue[head++];
            const cy = queue[head++];
            const pixel = getPixel(cx, cy);
            if (!pixel || pixel.a < NEIGHBOR_ALPHA_MIN || !colorMatches(seed, pixel)) {
                continue;
            }
            clearPixel(cx, cy);
            cleared++;
            for (let i = 0; i < NEIGHBORS.length; i++) {
                const nx = cx + NEIGHBORS[i][0];
                const ny = cy + NEIGHBORS[i][1];
                const key = pixelKey(nx, ny);
                if (seen[key]) {
                    continue;
                }
                seen[key] = 1;
                queue.push(nx, ny);
            }
        }

        return cleared;
    }

    return {
        SEED_ALPHA_MIN: SEED_ALPHA_MIN,
        NEIGHBOR_ALPHA_MIN: NEIGHBOR_ALPHA_MIN,
        COLOR_TOLERANCE: COLOR_TOLERANCE,
        floodClear: floodClear
    };
});
