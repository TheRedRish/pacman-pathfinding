import { MAPS } from "./maps.js";
import { ALGORITHM_NAMES, runAlgorithm } from "./algorithms.js";

const API_URL = "http://localhost:3000";

export async function runBenchmark(mapName, { trials = 10, maxTicks = 500 } = {}) {
    const map = MAPS[mapName];
    if (!map) throw new Error(`Unknown map: ${mapName}`);

    const results = [];

    for (const algoName of ALGORITHM_NAMES) {
        let totalTime = 0;
        let totalNodes = 0;
        let totalTicks = 0;
        let catches = 0;

        for (let trial = 0; trial < trials; trial++) {
            let ghostPos = { x: map.ghosts[0].x, y: map.ghosts[0].y };
            const pacmanPos = { ...map.pacman };
            let ticks = 0;
            let caught = false;

            while (ticks < maxTicks && !caught) {
                const plan = runAlgorithm(algoName, ghostPos, pacmanPos, map.data, []);

                totalTime += plan.timeMs;
                totalNodes += plan.nodesVisited;

                if (plan.nextMove) {
                    ghostPos = { ...plan.nextMove };
                    if (ghostPos.x === pacmanPos.x && ghostPos.y === pacmanPos.y) {
                        caught = true;
                        catches++;
                        totalTicks += ticks;
                    }
                }

                ticks++;
            }

            if (!caught) {
                totalTicks += maxTicks;
            }
        }

        results.push({
            algorithm: algoName,
            avgTimeMs: totalTime / (trials * maxTicks),
            avgNodesVisited: totalNodes / (trials * maxTicks),
            avgTicksToCatch: totalTicks / trials,
            catchRate: catches / trials,
            trials,
            mapName
        });
    }

    return results;
}

export async function saveBenchmarkResults(mapName, results) {
    const payload = {
        mapName,
        results,
        timestamp: new Date().toISOString()
    };

    const response = await fetch(`${API_URL}/api/benchmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error("Failed to save benchmark results");
    }

    return true;
}
