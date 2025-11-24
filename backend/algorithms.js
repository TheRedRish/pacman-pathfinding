/**
 * Pathfinding Algorithms for Pac-Man
 * Implements BFS, DFS, Dijkstra's, and A*
 */

const posKey = (p) => `${p.x},${p.y}`;

const parseKey = (k) => {
    const [x, y] = k.split(',').map(Number);
    return { x, y };
};

/**
 * Get valid neighboring positions
 */
function getNeighbors(pos, state) {
    const neighbors = [];
    const directions = [
        { x: 0, y: -1 },  // up
        { x: 1, y: 0 },   // right
        { x: 0, y: 1 },   // down
        { x: -1, y: 0 }   // left
    ];

    for (const dir of directions) {
        const newPos = { x: pos.x + dir.x, y: pos.y + dir.y };

        // Check bounds
        if (newPos.x >= 0 && newPos.x < state.width &&
            newPos.y >= 0 && newPos.y < state.height) {

            // Check walls
            if (state.grid[newPos.y][newPos.x] !== 'wall') {
                // Check ghost collision
                const hasGhost = state.ghosts.some(g =>
                    g.x === newPos.x && g.y === newPos.y
                );

                if (!hasGhost) {
                    neighbors.push(newPos);
                }
            }
        }
    }

    return neighbors;
}

/**
 * Manhattan distance heuristic for A*
 */
function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Convert Set of position keys to array of position objects
 */
function setToPositions(set) {
    return Array.from(set).map(parseKey);
}

function getStepCost(pos, state) {
    const cell = state.grid?.[pos.y]?.[pos.x];

    if (cell === 'pellet' || cell === 2) return 0.5;
    if (cell === 'power-pellet' || cell === 3) return 0.25;

    return 1;
}

/**
 * BFS - Breadth-First Search
 * Explores all neighbors at current depth before moving deeper
 * Guarantees shortest path in unweighted graphs
 */
function bfs(start, goal, state) {
    const visited = new Set();
    const frontier = new Set();
    const queue = [];

    queue.push({ pos: start, path: [start] });
    frontier.add(posKey(start));

    while (queue.length > 0) {
        const { pos, path } = queue.shift();
        const key = posKey(pos);

        frontier.delete(key);

        if (visited.has(key)) continue;
        visited.add(key);

        // Goal check
        if (pos.x === goal.x && pos.y === goal.y) {
            return {
                nextMove: path.length > 1 ? path[1] : null,
                visited: setToPositions(visited),
                frontier: setToPositions(frontier),
                path,
                nodesVisited: visited.size
            };
        }

        // Explore neighbors
        for (const neighbor of getNeighbors(pos, state)) {
            const nKey = posKey(neighbor);
            if (!visited.has(nKey)) {
                queue.push({
                    pos: neighbor,
                    path: [...path, neighbor]
                });
                frontier.add(nKey);
            }
        }
    }

    return {
        nextMove: null,
        visited: setToPositions(visited),
        frontier: setToPositions(frontier),
        path: [],
        nodesVisited: visited.size
    };
}

/**
 * DFS - Depth-First Search
 * Explores as far as possible along each branch before backtracking
 * Lower memory usage but doesn't guarantee shortest path
 */
function dfs(start, goal, state) {
    const visited = new Set();
    const frontier = new Set();
    const stack = [];

    stack.push({ pos: start, path: [start] });
    frontier.add(posKey(start));

    while (stack.length > 0) {
        const { pos, path } = stack.pop();
        const key = posKey(pos);

        frontier.delete(key);

        if (visited.has(key)) continue;
        visited.add(key);

        // Goal check
        if (pos.x === goal.x && pos.y === goal.y) {
            return {
                nextMove: path.length > 1 ? path[1] : null,
                visited: setToPositions(visited),
                frontier: setToPositions(frontier),
                path,
                nodesVisited: visited.size
            };
        }

        // Explore neighbors (in reverse to maintain left-to-right priority)
        const neighbors = getNeighbors(pos, state);
        for (let i = neighbors.length - 1; i >= 0; i--) {
            const neighbor = neighbors[i];
            const nKey = posKey(neighbor);
            if (!visited.has(nKey)) {
                stack.push({
                    pos: neighbor,
                    path: [...path, neighbor]
                });
                frontier.add(nKey);
            }
        }
    }

    return {
        nextMove: null,
        visited: setToPositions(visited),
        frontier: setToPositions(frontier),
        path: [],
        nodesVisited: visited.size
    };
}

/**
 * Dijkstra's Algorithm
 * Finds shortest path considering edge weights
 * Optimal for weighted graphs
 */
function dijkstra(start, goal, state) {
    const visited = new Set();
    const frontier = new Set();
    const dist = new Map();
    const prev = new Map();
    const pq = [];

    dist.set(posKey(start), 0);
    pq.push({ pos: start, cost: 0 });
    frontier.add(posKey(start));

    while (pq.length > 0) {
        // Sort to get minimum cost
        pq.sort((a, b) => a.cost - b.cost);
        const { pos, cost } = pq.shift();
        const key = posKey(pos);

        frontier.delete(key);

        if (visited.has(key)) continue;
        visited.add(key);

        // Goal check
        if (pos.x === goal.x && pos.y === goal.y) {
            // Reconstruct path
            const path = [];
            let curr = pos;
            while (curr) {
                path.unshift(curr);
                const currKey = posKey(curr);
                curr = prev.get(currKey);
            }

            return {
                nextMove: path.length > 1 ? path[1] : null,
                visited: setToPositions(visited),
                frontier: setToPositions(frontier),
                path,
                nodesVisited: visited.size
            };
        }

        // Explore neighbors
        for (const neighbor of getNeighbors(pos, state)) {
            const nKey = posKey(neighbor);
            const newCost = cost + getStepCost(neighbor, state);

            if (!dist.has(nKey) || newCost < dist.get(nKey)) {
                dist.set(nKey, newCost);
                prev.set(nKey, pos);
                pq.push({ pos: neighbor, cost: newCost });
                frontier.add(nKey);
            }
        }
    }

    return {
        nextMove: null,
        visited: setToPositions(visited),
        frontier: setToPositions(frontier),
        path: [],
        nodesVisited: visited.size
    };
}

/**
 * A* Algorithm
 * Uses heuristic (Manhattan distance) to guide search
 * Optimal when heuristic is admissible
 * Often explores fewer nodes than Dijkstra
 */
function astar(start, goal, state) {
    const visited = new Set();
    const frontier = new Set();
    const gScore = new Map();
    const fScore = new Map();
    const prev = new Map();
    const pq = [];

    gScore.set(posKey(start), 0);
    fScore.set(posKey(start), manhattan(start, goal));
    pq.push({ pos: start, f: fScore.get(posKey(start)) });
    frontier.add(posKey(start));

    while (pq.length > 0) {
        // Sort by f-score
        pq.sort((a, b) => a.f - b.f);
        const { pos } = pq.shift();
        const key = posKey(pos);

        frontier.delete(key);

        if (visited.has(key)) continue;
        visited.add(key);

        // Goal check
        if (pos.x === goal.x && pos.y === goal.y) {
            // Reconstruct path
            const path = [];
            let curr = pos;
            while (curr) {
                path.unshift(curr);
                const currKey = posKey(curr);
                curr = prev.get(currKey);
            }

            return {
                nextMove: path.length > 1 ? path[1] : null,
                visited: setToPositions(visited),
                frontier: setToPositions(frontier),
                path,
                nodesVisited: visited.size
            };
        }

        const g = gScore.get(key);

        // Explore neighbors
        for (const neighbor of getNeighbors(pos, state)) {
            const nKey = posKey(neighbor);
            const tentativeG = g + 1;

            if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
                gScore.set(nKey, tentativeG);
                const h = manhattan(neighbor, goal);
                fScore.set(nKey, tentativeG + h);
                prev.set(nKey, pos);
                pq.push({ pos: neighbor, f: fScore.get(nKey) });
                frontier.add(nKey);
            }
        }
    }

    return {
        nextMove: null,
        visited: setToPositions(visited),
        frontier: setToPositions(frontier),
        path: [],
        nodesVisited: visited.size
    };
}

module.exports = {
    bfs,
    dfs,
    dijkstra,
    astar,
    getNeighbors,
    manhattan
};