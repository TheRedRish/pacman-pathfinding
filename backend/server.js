const express = require('express');
const cors = require('cors');
const path = require('path');
const { performance } = require('perf_hooks');
require('dotenv').config();

const {
    bfs,
    dfs,
    dijkstra,
    astar
} = require('./algorithms');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Algorithm mapping
const algorithms = {
    'BFS': bfs,
    'DFS': dfs,
    'Dijkstra': dijkstra,
    'A*': astar
};

// Helper function to convert maze format
function convertMaze(maze) {
    return maze.map(row =>
        row.map(cell => cell === 1 ? 'wall' : 'empty')
    );
}

// API Routes

/**
 * POST /api/pathfind
 * Execute a single pathfinding operation
 */
app.post('/api/pathfind', (req, res) => {
    try {
        const { start, goal, maze, algorithm, ghosts } = req.body;

        // Validate input
        if (!start || !goal || !maze || !algorithm) {
            return res.status(400).send({
                error: 'Missing required fields: start, goal, maze, algorithm'
            });
        }

        if (!algorithms[algorithm]) {
            return res.status(400).send({
                error: `Unknown algorithm: ${algorithm}. Valid options: BFS, DFS, Dijkstra, A*`
            });
        }

        // Convert maze format
        const gridMap = convertMaze(maze);

        // Create world state
        const worldState = {
            grid: gridMap,
            width: maze[0].length,
            height: maze.length,
            ghosts: ghosts || []
        };

        // Execute algorithm
        const startTime = performance.now();
        const result = algorithms[algorithm](start, goal, worldState);
        const endTime = performance.now();

        // Return result
        res.send({
            ...result,
            algorithm,
            timeMs: endTime - startTime
        });

    } catch (error) {
        console.error('Pathfinding error:', error);
        res.status(500).send({
            error: 'Internal server error during pathfinding',
            details: error.message
        });
    }
});

/**
 * POST /api/benchmark
 * Run comprehensive benchmark tests
 */
app.post('/api/benchmark', async (req, res) => {
    try {
        const { maze, trials = 10 } = req.body;

        if (!maze) {
            return res.status(400).send({ error: 'Maze is required' });
        }

        const gridMap = convertMaze(maze);
        const worldState = {
            grid: gridMap,
            width: maze[0].length,
            height: maze.length,
            ghosts: []
        };

        const results = [];
        const maxTicks = 500;

        // Test each algorithm
        for (const [algoName, algoFunc] of Object.entries(algorithms)) {
            let totalTime = 0;
            let totalNodes = 0;
            let totalTicks = 0;
            let catches = 0;

            // Run multiple trials
            for (let trial = 0; trial < trials; trial++) {
                // Starting positions
                const ghostStart = { x: 1, y: 1 };
                const pacmanPos = { x: 14, y: 23 };

                let ghostPos = { ...ghostStart };
                let ticks = 0;
                let caught = false;

                // Simulate until caught or max ticks
                while (ticks < maxTicks && !caught) {
                    const startTime = performance.now();
                    const plan = algoFunc(ghostPos, pacmanPos, worldState);
                    const endTime = performance.now();

                    totalTime += (endTime - startTime);
                    totalNodes += plan.nodesVisited;

                    if (plan.nextMove) {
                        ghostPos = plan.nextMove;

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
                trials
            });
        }

        res.send(results);

    } catch (error) {
        console.error('Benchmark error:', error);
        res.status(500).send({
            error: 'Internal server error during benchmark',
            details: error.message
        });
    }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
        algorithms: Object.keys(algorithms)
    });
});

/**
 * GET /
 * Serve frontend
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send({
        error: 'Something went wrong!',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   PAC-MAN PATHFINDING SERVER                              ║
║                                                           ║
║  Server running on: http://localhost:${PORT}                 ║
║  Frontend: http://localhost:${PORT}                          ║
║  API Health: http://localhost:${PORT}/api/health             ║
║                                                           ║
║  Algorithms: BFS, DFS, Dijkstra, A*                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;