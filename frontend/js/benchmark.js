import { MAPS } from "./maps.js";
import { ALGORITHM_NAMES, runAlgorithm } from "./algorithms.js";
import { API_URL } from "./api.js";

export async function runBenchmark(
    mapName,
    { trials = 10, maxTicks = 500, algorithms = ALGORITHM_NAMES } = {},
    onProgress = () => { }
) {
    const map = MAPS[mapName];
    if (!map) throw new Error(`Unknown map: ${mapName}`);

    const selectedAlgorithms = (algorithms && algorithms.length ? algorithms : ALGORITHM_NAMES)
        .filter((name) => ALGORITHM_NAMES.includes(name));

    if (selectedAlgorithms.length === 0) {
        throw new Error("No valid algorithms selected for benchmark");
    }

    const results = [];
    const totalSteps = selectedAlgorithms.length * trials;
    let completedSteps = 0;

    onProgress(0);

    for (const algoName of selectedAlgorithms) {
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

            completedSteps++;
            onProgress(completedSteps / totalSteps);
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

    onProgress(1);

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
