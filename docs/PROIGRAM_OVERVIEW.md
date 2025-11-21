# Pac-Man Pathfinding Program Overview

This document explains how the project is structured and how the pathfinding algorithms work inside the simulation. The focus is on the algorithm flow in the browser and how supporting pieces (rendering, controls, backend APIs) connect to that loop.

## High-level architecture

- **Frontend**: A single-page canvas app that runs all pathfinding in the browser. `GameEngine` orchestrates simulation ticks, calls the chosen algorithm for each ghost, and renders the maze state.
- **Backend**: A lightweight Express server that only handles persistence and analytics (health checks, benchmark storage, custom maps, CSV export). Pathfinding itself stays in the client.
- **Shared data model**: Maze layouts (`MAPS`), Pac-Man and ghost positions, and per-ghost algorithm choice are stored in memory on the client for fast updates between ticks.

## Runtime flow (frontend)

1. **Boot**: `main.js` wires a `GameEngine` to the canvas and hands it to `UIController` for controls.
2. **Map loading**: `GameEngine.loadMap` clones the selected maze, resets Pac-Man and ghosts, and resizes the renderer. Ghosts keep their previously chosen algorithm when switching maps.
3. **Control layer**: `UIController` builds map buttons, algorithm selectors per ghost, and benchmark controls; it also fetches backend status and saved maps.
4. **Tick loop**: When running, `GameEngine.tick` iterates over each ghost, runs its selected algorithm against the current maze, and moves it one step along the returned path. If the ghost is currently visualized, the plan is stored for rendering/metrics; catching Pac-Man stops the loop.
5. **Rendering**: The `Renderer` draws the maze, Pac-Man, ghosts, and optionally the chosen ghost’s explored/visited sets and path; the renderer reads the latest state via `getState`.

## Pathfinding algorithms (frontend)

All algorithms operate on the 2D grid and avoid walls and other ghosts using the shared neighbor helper.

### Neighbor generation

`getNeighbors` returns passable adjacent cells (up, right, down, left) that are inside the maze, are not walls, and do not contain another ghost. This keeps moves legal for all algorithms.

### BFS (Breadth-First Search)

- **Strategy**: Explores equally outward using a queue and tracks frontier/visited sets for visualization.
- **Return value**: The next move toward Pac-Man, the full path, visited/frontier cells, nodes visited count, and elapsed time.
- **Strengths**: Guaranteed shortest path on this unweighted grid; predictable expansion for teaching/analysis.

### DFS (Depth-First Search)

- **Strategy**: Uses a stack to dive deep before backtracking. Nodes are marked visited on push to avoid duplicates.
- **Characteristics**: Low memory use but does not guarantee shortest paths; good for comparing exploration patterns.

### Dijkstra’s Algorithm

- **Strategy**: Uniform-cost search using a priority queue (sorted array here) and `dist/prev` maps to rebuild the optimal path.
- **Use case**: Equivalent to BFS on this uniform grid but highlights weighted-graph behavior and cost tracking.

### A\* Search

- **Strategy**: Extends Dijkstra by adding a Manhattan-distance heuristic (`f = g + h`) to focus the search toward Pac-Man.
- **Behavior**: Often visits fewer nodes than Dijkstra/BFS while remaining optimal because Manhattan distance is admissible on grid moves.

## Backend algorithms module

The backend includes a parallel implementation of the same algorithms. They follow the same neighbor rules and return structure, which keeps server-side benchmarking or future server execution aligned with the client behavior.

## Data persistence & analytics (backend)

- **Benchmark storage**: `/api/benchmarks` saves runs with map name, per-algorithm metrics, and user agent; `/api/benchmarks/stats` aggregates averages per algorithm and per map.
- **Custom maps**: `/api/maps` saves maze definitions (grid, Pac-Man, ghosts) while `/api/maps` GET lists them for the frontend selector.
- **Exports**: `/api/export/benchmarks` outputs CSV for offline analysis.

## Key takeaways

- Pathfinding is intentionally client-side for responsiveness; the backend focuses on storing results and maps.
- Each ghost can run a different algorithm, letting you compare strategies in the same simulation run.
- Visualization data (visited/frontier/path) is produced directly by the algorithms to support teaching and benchmarking.
