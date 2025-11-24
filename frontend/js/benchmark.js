import { MAPS } from "./maps.js";
import { runAlgorithm } from "./algorithms.js";
import { API_URL } from "./api.js";

function clampGhostCount(map, desired) {
    const available = map.ghosts?.length || 0;
    const capped = Math.min(4, available || 1);
    if (!desired) return capped;
    return Math.max(1, Math.min(desired, capped));
}

function cloneMaze(map) {
    return map.data.map((row) => [...row]);
}

function isWithinBounds(maze, pos) {
    return (
        pos.y >= 0 &&
        pos.y < maze.length &&
        pos.x >= 0 &&
        pos.x < maze[0].length
    );
}

function isWalkable(maze, pos) {
    const cell = maze[pos.y]?.[pos.x];
    return cell !== 1;
}

function getOpenNeighbors(maze, pos) {
    const deltas = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 }
    ];

    return deltas
        .map((d) => ({ x: pos.x + d.x, y: pos.y + d.y }))
        .filter((p) => isWithinBounds(maze, p) && isWalkable(maze, p));
}

function isPellet(maze, pos) {
    const cell = maze[pos.y]?.[pos.x];
    return cell === 2 || cell === 3;
}

function consumePellet(maze, pos) {
    if (isPellet(maze, pos)) {
        maze[pos.y][pos.x] = 0;
    }
}

function getPellets(maze) {
    const pellets = [];

    for (let y = 0; y < maze.length; y++) {
        for (let x = 0; x < maze[y].length; x++) {
            const cell = maze[y][x];
            if (cell === 2 || cell === 3) {
                pellets.push({ x, y });
            }
        }
    }

    return pellets;
}

function getPelletsWithinRadius(maze, pacman, radius) {
    return getPellets(maze).filter((pellet) => {
        const dx = Math.abs(pellet.x - pacman.x);
        const dy = Math.abs(pellet.y - pacman.y);
        return dx + dy <= radius;
    });
}

function getBestPelletPath(maze, pacman, pellets, ghosts) {
    let bestPath = null;

    for (const pellet of pellets) {
        const { path } = runAlgorithm("BFS", pacman, pellet, maze, ghosts);

        if (path.length === 0) continue;

        if (!bestPath || path.length < bestPath.length) {
            bestPath = path;
        }
    }

    return bestPath;
}

function movePacmanTowardsPellet(maze, pacman, ghosts, randomness) {
    const pellets = getPelletsWithinRadius(maze, pacman, 5);
    const shouldMoveRandomly = Math.random() < randomness;

    if (pellets.length > 0 && !shouldMoveRandomly) {
        const bestPath = getBestPelletPath(maze, pacman, pellets, ghosts);

        if (bestPath && bestPath.length > 1) {
            const next = bestPath[1];
            pacman.x = next.x;
            pacman.y = next.y;
            consumePellet(maze, pacman);
            return;
        }
    }

    if (isPellet(maze, pacman)) {
        consumePellet(maze, pacman);
    }

    const neighbors = getOpenNeighbors(maze, pacman);
    if (neighbors.length === 0) return;

    const safeNeighbors = neighbors.filter(
        (pos) => !ghosts?.some((ghost) => ghost.x === pos.x && ghost.y === pos.y)
    );

    const candidates = safeNeighbors.length > 0 ? safeNeighbors : neighbors;
    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    pacman.x = choice.x;
    pacman.y = choice.y;
    consumePellet(maze, pacman);
}

export async function runBenchmark(
    mapName,
    {
        trials = 10,
        maxTicks = 500,
        pacmanRandomness = 0.2,
        ghostCount,
        ghostStartDelay = 10,
        ghostAlgorithms = [],
    } = {},
    onProgress = () => { }
) {
    const map = MAPS[mapName];
    if (!map) throw new Error(`Unknown map: ${mapName}`);

    const desiredCount = clampGhostCount(map, ghostCount || map.ghosts?.length || 1);
    const ghostTemplates = (map.ghosts || []).slice(0, desiredCount).map((ghost, idx) => ({
        ...ghost,
        algorithm: ghostAlgorithms[idx] || ghost.algorithm,
    }));

    if (ghostTemplates.length === 0) {
        throw new Error("No ghosts available for this map");
    }

    const algorithmStats = new Map();
    const uniqueAlgorithms = new Set(ghostTemplates.map((g) => g.algorithm));

    uniqueAlgorithms.forEach((algo) => {
        algorithmStats.set(algo, {
            algorithm: algo,
            totalTime: 0,
            totalNodesVisited: 0,
            totalTicks: 0,
            catches: 0,
            trials: 0,
            planningSteps: 0,
        });
    });

    onProgress(0);

    for (let trial = 0; trial < trials; trial++) {
        const maze = cloneMaze(map);
        const pacman = { ...map.pacman };
        const ghosts = ghostTemplates.map((g) => ({ ...g }));
        let ticks = 0;
        let caughtBy = null;

        uniqueAlgorithms.forEach((algo) => {
            const entry = algorithmStats.get(algo);
            entry.trials += 1;
        });

        while (ticks < maxTicks && !caughtBy) {
            ticks += 1;
            movePacmanTowardsPellet(maze, pacman, ghosts, pacmanRandomness);

            const initialCollision = ghosts.find(
                (ghost) => ghost.x === pacman.x && ghost.y === pacman.y
            );

            if (initialCollision) {
                caughtBy = initialCollision.algorithm;
                break;
            }

            const ghostsCanMove = ticks > ghostStartDelay;

            for (const ghost of ghosts) {
                if (!ghostsCanMove) continue;

                const plan = runAlgorithm(
                    ghost.algorithm,
                    { x: ghost.x, y: ghost.y },
                    pacman,
                    maze,
                    ghosts
                );

                const entry = algorithmStats.get(ghost.algorithm);
                if (entry) {
                    entry.totalTime += plan.timeMs;
                    entry.totalNodesVisited += plan.nodesVisited;
                    entry.planningSteps += 1;
                }

                if (plan.nextMove) {
                    ghost.x = plan.nextMove.x;
                    ghost.y = plan.nextMove.y;
                }

                if (ghost.x === pacman.x && ghost.y === pacman.y) {
                    caughtBy = ghost.algorithm;
                    break;
                }
            }
        }

        uniqueAlgorithms.forEach((algo) => {
            const entry = algorithmStats.get(algo);
            if (!entry) return;

            if (caughtBy === algo) {
                entry.catches += 1;
                entry.totalTicks += ticks;
            } else {
                entry.totalTicks += maxTicks;
            }
        });

        onProgress((trial + 1) / trials);
    }

    const results = Array.from(algorithmStats.values()).map((entry) => {
        const averageTime = entry.planningSteps > 0
            ? entry.totalTime / entry.planningSteps
            : 0;
        const averageNodes = entry.planningSteps > 0
            ? entry.totalNodesVisited / entry.planningSteps
            : 0;

        return {
            algorithm: entry.algorithm,
            avgTimeMs: averageTime,
            avgNodesVisited: averageNodes,
            avgTicksToCatch: entry.trials > 0 ? entry.totalTicks / entry.trials : 0,
            catchRate: entry.trials > 0 ? entry.catches / entry.trials : 0,
            trials,
            mapName,
        };
    });

    onProgress(1);

    return results;
}

export async function saveBenchmarkResults(mapName, results, pacmanRandomness, note) {
    const payload = {
        mapName,
        results,
        timestamp: new Date().toISOString(),
        pacmanRandomness,
        note: note?.trim() || undefined
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
