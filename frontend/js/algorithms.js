// Convert a coordinate into a string key for Sets/Maps (e.g., "3,5")
const posKey = (p) => `${p.x},${p.y}`;

const parseKey = (k) => {
  const [x, y] = k.split(",").map(Number);
  return { x, y };
};

// Manhattan distance heuristic used by A*
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Convert Set of position keys back into coordinate objects
const setToPositions = (set) => Array.from(set).map(parseKey);

// Determine the movement cost for stepping onto a given maze cell
function getStepCost(pos, maze) {
  const cell = maze[pos.y]?.[pos.x];

  if (cell === 2 || cell === 3) return 0.9; // Pellet

  return 1; // Empty path
}

// Return valid neighboring positions that are inside bounds and not walls
function getNeighbors(pos, maze, ghosts) {
  const neighbors = [];
  const dirs = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  for (const dir of dirs) {
    const newPos = { x: pos.x + dir.x, y: pos.y + dir.y };

    if (
      newPos.x >= 0 &&
      newPos.x < maze[0].length &&
      newPos.y >= 0 &&
      newPos.y < maze.length &&
      maze[newPos.y][newPos.x] !== 1 // Not a wall
    ) {
      neighbors.push(newPos);
    }
  }

  return neighbors;
}

// Breadth-First Search explores level by level; optimal for unweighted grids
function bfs(start, goal, maze, ghosts) {
  const startTime = performance.now();
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

    if (pos.x === goal.x && pos.y === goal.y) {
      return {
        nextMove: path.length > 1 ? path[1] : null,
        visited: setToPositions(visited),
        frontier: setToPositions(frontier),
        path,
        nodesVisited: visited.size,
        timeMs: performance.now() - startTime,
      };
    }

    for (const neighbor of getNeighbors(pos, maze, ghosts)) {
      const nKey = posKey(neighbor);
      if (!visited.has(nKey) && !frontier.has(nKey)) {
        queue.push({ pos: neighbor, path: [...path, neighbor] });
        frontier.add(nKey);
      }
    }
  }

  return {
    nextMove: null,
    visited: setToPositions(visited),
    frontier: setToPositions(frontier),
    path: [],
    nodesVisited: visited.size,
    timeMs: performance.now() - startTime,
  };
}

// Depth-First Search explores paths deeply before backtracking; not weight-aware
function dfs(start, goal, maze, ghosts) {
  const startTime = performance.now();
  const visited = new Set();
  const stack = [];

  stack.push({ pos: start, path: [start] });
  visited.add(posKey(start));

  while (stack.length > 0) {
    const { pos, path } = stack.pop();

    if (pos.x === goal.x && pos.y === goal.y) {
      return {
        nextMove: path.length > 1 ? path[1] : null,
        visited: setToPositions(visited),
        frontier: [],
        path,
        nodesVisited: visited.size,
        timeMs: performance.now() - startTime,
      };
    }

    for (const neighbor of getNeighbors(pos, maze, ghosts)) {
      const nKey = posKey(neighbor);
      if (!visited.has(nKey)) {
        visited.add(nKey);
        stack.push({ pos: neighbor, path: [...path, neighbor] });
      }
    }
  }

  return {
    nextMove: null,
    visited: setToPositions(visited),
    frontier: [],
    path: [],
    nodesVisited: visited.size,
    timeMs: performance.now() - startTime,
  };
}

// Dijkstra's algorithm finds the lowest-cost path respecting weighted steps
function dijkstra(start, goal, maze, ghosts) {
  const startTime = performance.now();
  const visited = new Set();
  const frontier = new Set();
  const dist = new Map();
  const prev = new Map();
  const pq = [];

  dist.set(posKey(start), 0);
  pq.push({ pos: start, cost: 0 });
  frontier.add(posKey(start));

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const { pos } = pq.shift();
    const key = posKey(pos);

    frontier.delete(key);

    if (visited.has(key)) continue;
    visited.add(key);

    if (pos.x === goal.x && pos.y === goal.y) {
      const path = [];
      let curr = pos;
      while (curr) {
        path.unshift(curr);
        curr = prev.get(posKey(curr));
      }

      return {
        nextMove: path.length > 1 ? path[1] : null,
        visited: setToPositions(visited),
        frontier: setToPositions(frontier),
        path,
        nodesVisited: visited.size,
        timeMs: performance.now() - startTime,
      };
    }

    const g = dist.get(key);

    for (const neighbor of getNeighbors(pos, maze, ghosts)) {
      const nKey = posKey(neighbor);
      const newCost = g + getStepCost(neighbor, maze);

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
    nodesVisited: visited.size,
    timeMs: performance.now() - startTime,
  };
}

// A* search combines path cost with heuristic distance for faster convergence
function astar(start, goal, maze, ghosts) {
  const startTime = performance.now();
  const visited = new Set();
  const frontier = new Set();
  const gScore = new Map();
  const fScore = new Map();
  const prev = new Map();
  const pq = [];

  gScore.set(posKey(start), 0);
  fScore.set(posKey(start), manhattan(start, goal) * 0.9);
  pq.push({ pos: start, f: fScore.get(posKey(start)) });
  frontier.add(posKey(start));

  while (pq.length > 0) {
    pq.sort((a, b) => a.f - b.f);
    const { pos } = pq.shift();
    const key = posKey(pos);

    frontier.delete(key);

    if (visited.has(key)) continue;
    visited.add(key);

    if (pos.x === goal.x && pos.y === goal.y) {
      const path = [];
      let curr = pos;
      while (curr) {
        path.unshift(curr);
        curr = prev.get(posKey(curr));
      }

      return {
        nextMove: path.length > 1 ? path[1] : null,
        visited: setToPositions(visited),
        frontier: setToPositions(frontier),
        path,
        nodesVisited: visited.size,
        timeMs: performance.now() - startTime,
      };
    }

    const g = gScore.get(key);

    for (const neighbor of getNeighbors(pos, maze, ghosts)) {
      const nKey = posKey(neighbor);
      const tentativeG = g + getStepCost(neighbor, maze);

      if (!gScore.has(nKey) || tentativeG < gScore.get(nKey)) {
        gScore.set(nKey, tentativeG);
        const h = manhattan(neighbor, goal) * 0.9;
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
    nodesVisited: visited.size,
    timeMs: performance.now() - startTime,
  };
}

export const ALGORITHM_NAMES = ["BFS", "DFS", "Dijkstra", "A*"];

export function runAlgorithm(algoName, start, goal, maze, ghosts) {
  switch (algoName) {
    case "BFS":
      return bfs(start, goal, maze, ghosts);
    case "DFS":
      return dfs(start, goal, maze, ghosts);
    case "Dijkstra":
      return dijkstra(start, goal, maze, ghosts);
    case "A*":
      return astar(start, goal, maze, ghosts);
    default:
      throw new Error(`Unknown algorithm: ${algoName}`);
  }
}
