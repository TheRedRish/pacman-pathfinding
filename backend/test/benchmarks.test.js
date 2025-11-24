const { before, after, afterEach, test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs/promises');
const app = require('../server');

const dataDir = path.join(__dirname, '..', 'data');
const benchmarksFile = path.join(dataDir, 'benchmarks.json');
const mapsFile = path.join(dataDir, 'maps.json');

let server;
let baseUrl;
let originalBenchmarks;
let originalMaps;

before(async () => {
    originalBenchmarks = await fs.readFile(benchmarksFile, 'utf8');
    originalMaps = await fs.readFile(mapsFile, 'utf8');

    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
    if (originalBenchmarks !== undefined) {
        await fs.writeFile(benchmarksFile, originalBenchmarks);
    }
    if (originalMaps !== undefined) {
        await fs.writeFile(mapsFile, originalMaps);
    }
});

after(async () => {
    if (server) {
        await new Promise(resolve => server.close(resolve));
    }
});

function buildStats(benchmarks) {
    if (benchmarks.length === 0) {
        return { totalBenchmarks: 0, algorithms: {}, maps: {} };
    }

    const stats = {
        totalBenchmarks: benchmarks.length,
        algorithms: {},
        maps: {},
    };

    benchmarks.forEach(benchmark => {
        if (!stats.maps[benchmark.mapName]) {
            stats.maps[benchmark.mapName] = {
                count: 0,
                algorithms: {},
            };
        }
        stats.maps[benchmark.mapName].count++;

        benchmark.results.forEach(result => {
            const algo = result.algorithm;

            if (!stats.algorithms[algo]) {
                stats.algorithms[algo] = {
                    totalRuns: 0,
                    avgTime: 0,
                    avgNodes: 0,
                    avgTicks: 0,
                    avgCatchRate: 0,
                };
            }

            const algoStats = stats.algorithms[algo];
            const n = algoStats.totalRuns;
            algoStats.avgTime = (algoStats.avgTime * n + result.avgTimeMs) / (n + 1);
            algoStats.avgNodes = (algoStats.avgNodes * n + result.avgNodesVisited) / (n + 1);
            algoStats.avgTicks = (algoStats.avgTicks * n + result.avgTicksToCatch) / (n + 1);
            algoStats.avgCatchRate = (algoStats.avgCatchRate * n + result.catchRate) / (n + 1);
            algoStats.totalRuns++;

            if (!stats.maps[benchmark.mapName].algorithms[algo]) {
                stats.maps[benchmark.mapName].algorithms[algo] = {
                    count: 0,
                    avgTime: 0,
                };
            }

            const mapAlgoStats = stats.maps[benchmark.mapName].algorithms[algo];
            const m = mapAlgoStats.count;
            mapAlgoStats.avgTime = (mapAlgoStats.avgTime * m + result.avgTimeMs) / (m + 1);
            mapAlgoStats.count++;
        });
    });

    return stats;
}

function nearlyEqual(a, b, epsilon = 1e-9) {
    return Math.abs(a - b) <= epsilon;
}

test('health endpoint returns ok status and timestamp', async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(response.status, 200);

    const payload = await response.json();
    assert.strictEqual(payload.status, 'ok');
    assert.ok(payload.timestamp);
});

test('saves new benchmarks and trims note input', async () => {
    const payload = {
        mapName: 'test-map',
        results: [
            {
                algorithm: 'BFS',
                avgTimeMs: 1.23,
                avgNodesVisited: 10,
                avgTicksToCatch: 20,
                catchRate: 0.75,
                trials: 1,
                mapName: 'test-map',
            },
        ],
        timestamp: new Date().toISOString(),
        pacmanRandomness: 0.1,
        note: '   padded note   ',
    };

    const response = await fetch(`${baseUrl}/api/benchmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    assert.strictEqual(response.status, 200);
    const { id } = await response.json();
    assert.ok(id);

    const stored = JSON.parse(await fs.readFile(benchmarksFile, 'utf8'));
    const savedEntry = stored.find(entry => entry.id === id);
    assert.ok(savedEntry, 'benchmark should be persisted to disk');
    assert.strictEqual(savedEntry.note, 'padded note');
    assert.strictEqual(savedEntry.results[0].algorithm, 'BFS');
});

test('aggregates benchmark statistics using persisted data', async () => {
    const expected = buildStats(JSON.parse(originalBenchmarks));

    const response = await fetch(`${baseUrl}/api/benchmarks/stats`);
    assert.strictEqual(response.status, 200);
    const stats = await response.json();

    assert.strictEqual(stats.totalBenchmarks, expected.totalBenchmarks);
    assert.deepStrictEqual(Object.keys(stats.algorithms).sort(), Object.keys(expected.algorithms).sort());

    const algorithmToCheck = 'A*';
    const expectedAlgo = expected.algorithms[algorithmToCheck];
    const actualAlgo = stats.algorithms[algorithmToCheck];

    assert.ok(actualAlgo.totalRuns >= expectedAlgo.totalRuns);
    assert.ok(nearlyEqual(actualAlgo.avgTime, expectedAlgo.avgTime));
    assert.ok(nearlyEqual(actualAlgo.avgNodes, expectedAlgo.avgNodes));
    assert.ok(nearlyEqual(actualAlgo.avgCatchRate, expectedAlgo.avgCatchRate));

    const mapName = Object.keys(expected.maps)[0];
    assert.strictEqual(stats.maps[mapName].count, expected.maps[mapName].count);
});
