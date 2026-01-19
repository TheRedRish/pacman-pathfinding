const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Data storage paths
const DATA_DIR = path.join(__dirname, 'data');
const BENCHMARKS_FILE = path.join(DATA_DIR, "benchmarks_exam.json");
const MAPS_FILE = path.join(DATA_DIR, 'maps.json');

// Initialize data directory
async function initDataDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });

        // Initialize files if they don't exist
        try {
            await fs.access(BENCHMARKS_FILE);
        } catch {
            await fs.writeFile(BENCHMARKS_FILE, JSON.stringify([]));
        }

        try {
            await fs.access(MAPS_FILE);
        } catch {
            await fs.writeFile(MAPS_FILE, JSON.stringify([]));
        }
    } catch (error) {
        console.error('Error initializing data directory:', error);
    }
}

initDataDir();

// ============= API ROUTES =============

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Pac-Man Pathfinding API is running'
    });
});

/**
 * POST /api/benchmarks
 * Save benchmark results
 */
app.post('/api/benchmarks', async (req, res) => {
    try {
        const { mapName, results, timestamp, pacmanRandomness, note } = req.body;

        if (!mapName || !results || !timestamp || pacmanRandomness === undefined) {
            return res.status(400).json({
                error: 'Missing required fields: mapName, results, timestamp, pacmanRandomness'
            });
        }

        if (typeof pacmanRandomness !== 'number' || Number.isNaN(pacmanRandomness)) {
            return res.status(400).json({
                error: 'pacmanRandomness must be a number'
            });
        }

        if (note !== undefined && typeof note !== 'string') {
            return res.status(400).json({
                error: 'note must be a string when provided'
            });
        }

        const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 200) : undefined;

        // Read existing benchmarks
        const data = await fs.readFile(BENCHMARKS_FILE, 'utf8');
        const benchmarks = JSON.parse(data);

        // Add new benchmark
        const benchmarkEntry = {
            id: Date.now().toString(),
            mapName,
            results,
            timestamp,
            pacmanRandomness,
            note: trimmedNote,
            userAgent: req.headers['user-agent']
        };

        benchmarks.push(benchmarkEntry);

        // Save back to file
        await fs.writeFile(BENCHMARKS_FILE, JSON.stringify(benchmarks, null, 2));

        res.json({
            success: true,
            id: benchmarkEntry.id,
            message: 'Benchmark saved successfully'
        });

    } catch (error) {
        console.error('Error saving benchmark:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * GET /api/benchmarks
 * Get all benchmark results (optionally filtered by map)
 */
app.get('/api/benchmarks', async (req, res) => {
    try {
        const { mapName, limit = 50 } = req.query;

        const data = await fs.readFile(BENCHMARKS_FILE, 'utf8');
        let benchmarks = JSON.parse(data);

        // Filter by map if specified
        if (mapName) {
            benchmarks = benchmarks.filter(b => b.mapName === mapName);
        }

        const parsedLimit = parseInt(limit, 10);
        const safeLimit = Number.isFinite(parsedLimit) ? parsedLimit : 50;

        // Limit results
        benchmarks = benchmarks.slice(-safeLimit);

        res.json(benchmarks);

    } catch (error) {
        console.error('Error retrieving benchmarks:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * GET /api/benchmarks/stats
 * Get aggregate statistics across all benchmarks
 */
app.get('/api/benchmarks/stats', async (req, res) => {
    try {
        const data = await fs.readFile(BENCHMARKS_FILE, 'utf8');
        const benchmarks = JSON.parse(data);

        if (benchmarks.length === 0) {
            return res.json({
                totalBenchmarks: 0,
                algorithms: {},
                maps: {}
            });
        }

        // Aggregate statistics
        const stats = {
            totalBenchmarks: benchmarks.length,
            algorithms: {},
            maps: {}
        };

        benchmarks.forEach(benchmark => {
            // Map statistics
            if (!stats.maps[benchmark.mapName]) {
                stats.maps[benchmark.mapName] = {
                    count: 0,
                    algorithms: {}
                };
            }
            stats.maps[benchmark.mapName].count++;

            // Algorithm statistics
            benchmark.results.forEach(result => {
                const algo = result.algorithm;

                if (!stats.algorithms[algo]) {
                    stats.algorithms[algo] = {
                        totalRuns: 0,
                        avgTime: 0,
                        avgNodes: 0,
                        avgTicks: 0,
                        avgCatchRate: 0
                    };
                }

                const algoStats = stats.algorithms[algo];
                const n = algoStats.totalRuns;

                // Running average calculation
                algoStats.avgTime = (algoStats.avgTime * n + result.avgTimeMs) / (n + 1);
                algoStats.avgNodes = (algoStats.avgNodes * n + result.avgNodesVisited) / (n + 1);
                algoStats.avgTicks = (algoStats.avgTicks * n + result.avgTicksToCatch) / (n + 1);
                algoStats.avgCatchRate = (algoStats.avgCatchRate * n + result.catchRate) / (n + 1);
                algoStats.totalRuns++;

                // Per-map algorithm stats
                if (!stats.maps[benchmark.mapName].algorithms[algo]) {
                    stats.maps[benchmark.mapName].algorithms[algo] = {
                        count: 0,
                        avgTime: 0
                    };
                }
                const mapAlgoStats = stats.maps[benchmark.mapName].algorithms[algo];
                const m = mapAlgoStats.count;
                mapAlgoStats.avgTime = (mapAlgoStats.avgTime * m + result.avgTimeMs) / (m + 1);
                mapAlgoStats.count++;
            });
        });

        res.json(stats);

    } catch (error) {
        console.error('Error calculating stats:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * DELETE /api/benchmarks/:id
 * Delete a specific benchmark
 */
app.delete('/api/benchmarks/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const data = await fs.readFile(BENCHMARKS_FILE, 'utf8');
        let benchmarks = JSON.parse(data);

        const initialLength = benchmarks.length;
        benchmarks = benchmarks.filter(b => b.id !== id);

        if (benchmarks.length === initialLength) {
            return res.status(404).json({ error: 'Benchmark not found' });
        }

        await fs.writeFile(BENCHMARKS_FILE, JSON.stringify(benchmarks, null, 2));

        res.json({
            success: true,
            message: 'Benchmark deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting benchmark:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * POST /api/maps
 * Save a custom map
 */
app.post('/api/maps', async (req, res) => {
    try {
        const { name, width, height, data, pacman, ghosts } = req.body;

        if (!name || !width || !height || !data || !pacman || !ghosts) {
            return res.status(400).json({
                error: 'Missing required fields: name, width, height, data, pacman, ghosts'
            });
        }

        const mapsData = await fs.readFile(MAPS_FILE, 'utf8');
        const maps = JSON.parse(mapsData);

        const mapEntry = {
            id: Date.now().toString(),
            name,
            width,
            height,
            data,
            pacman,
            ghosts,
            createdAt: new Date().toISOString()
        };

        maps.push(mapEntry);
        await fs.writeFile(MAPS_FILE, JSON.stringify(maps, null, 2));

        res.json({
            success: true,
            id: mapEntry.id,
            message: 'Map saved successfully'
        });

    } catch (error) {
        console.error('Error saving map:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * GET /api/maps
 * Get all saved custom maps
 */
app.get('/api/maps', async (req, res) => {
    try {
        const data = await fs.readFile(MAPS_FILE, 'utf8');
        const maps = JSON.parse(data);

        res.json(maps);

    } catch (error) {
        console.error('Error retrieving maps:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * GET /api/export/benchmarks
 * Export all benchmarks as CSV
 */
app.get('/api/export/benchmarks', async (req, res) => {
    try {
        const data = await fs.readFile(BENCHMARKS_FILE, 'utf8');
        const benchmarks = JSON.parse(data);

        // Generate CSV
        let csv = 'Timestamp,Map,Pacman Randomness,Note,Algorithm,Avg Time (ms),Avg Nodes,Avg Ticks,Catch Rate\n';

        benchmarks.forEach(benchmark => {
            benchmark.results.forEach(result => {
                const note = (benchmark.note || '').replace(/"/g, '""');
                csv += `${benchmark.timestamp},${benchmark.mapName},${benchmark.pacmanRandomness ?? ''},"${note}",${result.algorithm},`;
                csv += `${result.avgTimeMs},${result.avgNodesVisited},${result.avgTicksToCatch},${result.catchRate}\n`;
            });
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=benchmarks.csv');
        res.send(csv);

    } catch (error) {
        console.error('Error exporting benchmarks:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
});

/**
 * GET /benchmarks
 * Serve benchmark explorer page
 */
app.get('/benchmarks', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/benchmarks.html'));
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
    res.status(500).json({
        error: 'Something went wrong!',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server when run directly
if (require.main === module) {
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
║   Backend Services:                                       ║
║  - Benchmark storage and analytics                        ║
║  - Custom map management                                  ║
║  - Historical data & statistics                           ║
║  - CSV export functionality                               ║
║                                                           ║
║   Pathfinding runs in browser (frontend)                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
    });
}

module.exports = app;