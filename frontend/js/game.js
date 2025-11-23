import { MAPS } from "./maps.js";
import { runAlgorithm } from "./algorithms.js";
import { Renderer } from "./rendering.js";

export class GameEngine {
    constructor(canvas, { enableRendering = true } = {}) {
        this.renderer = enableRendering && canvas ? new Renderer(canvas) : null;
        this.currentMapName = "classic";
        this.maze = null;
        this.pacman = null;
        this.ghosts = null;
        this.visualizingGhostId = null;
        this.lastPlan = null;
        this.isRunning = false;
        this.tickSpeed = 200;
        this.pacmanRandomness = 0.2;
        this.ghostStartDelay = 10;
        this.ticksElapsed = 0;
        this.ghostCount = 4;
        this.gameLoopId = null;

        this.onPlanComputed = () => { };
        this.onGhostCaught = () => { };

        this.loadMap(this.currentMapName);
    }

    setCallbacks({ onPlanComputed, onGhostCaught } = {}) {
        if (onPlanComputed) this.onPlanComputed = onPlanComputed;
        if (onGhostCaught) this.onGhostCaught = onGhostCaught;
    }

    loadMap(mapName) {
        const map = MAPS[mapName];
        if (!map) throw new Error(`Unknown map: ${mapName}`);

        this.currentMapName = mapName;
        this.maze = map.data.map((row) => [...row]);
        this.pacman = { ...map.pacman };

        const availableGhosts = map.ghosts || [];
        const desiredCount = Math.min(
            Math.max(1, this.ghostCount || availableGhosts.length),
            Math.min(4, availableGhosts.length)
        );
        this.ghostCount = desiredCount;
        this.ticksElapsed = 0;

        const existingGhosts = this.ghosts || [];
        this.ghosts = availableGhosts.slice(0, desiredCount).map((g) => {
            const existing = existingGhosts.find((eg) => eg.id === g.id);
            return {
                ...g,
                algorithm: existing ? existing.algorithm : g.algorithm
            };
        });

        this.visualizingGhostId = null;
        this.lastPlan = null;

        if (this.renderer) {
            this.renderer.resize(map.width, map.height);
        }
        this.render();
    }

    movePacmanTowardsPellet() {
        const pellets = this.getPelletsWithinRadius(5);
        const shouldMoveRandomly = Math.random() < this.pacmanRandomness;

        if (pellets.length > 0 && !shouldMoveRandomly) {
            const bestPath = this.getBestPelletPath(pellets);

            if (bestPath && bestPath.length > 1) {
                const next = bestPath[1];
                this.pacman.x = next.x;
                this.pacman.y = next.y;
                this.consumePellet(this.pacman);
                return;
            }
        }

        if (this.isPellet(this.pacman)) {
            this.consumePellet(this.pacman);
        }

        this.movePacmanRandomly();
        this.consumePellet(this.pacman);
    }

    getBestPelletPath(pellets) {
        let bestPath = null;

        for (const pellet of pellets) {
            const { path } = runAlgorithm(
                "BFS",
                this.pacman,
                pellet,
                this.maze,
                this.ghosts
            );

            if (path.length === 0) continue;

            if (!bestPath || path.length < bestPath.length) {
                bestPath = path;
            }
        }

        return bestPath;
    }

    movePacmanRandomly() {
        const neighbors = this.getOpenNeighbors(this.pacman);
        if (neighbors.length === 0) return;

        const safeNeighbors = neighbors.filter(
            (pos) => !this.ghosts?.some((ghost) => ghost.x === pos.x && ghost.y === pos.y)
        );

        const candidates = safeNeighbors.length > 0 ? safeNeighbors : neighbors;
        const choice = candidates[Math.floor(Math.random() * candidates.length)];
        this.pacman.x = choice.x;
        this.pacman.y = choice.y;
    }

    getOpenNeighbors(pos) {
        if (!this.maze) return [];

        const deltas = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 }
        ];

        return deltas
            .map((d) => ({ x: pos.x + d.x, y: pos.y + d.y }))
            .filter((p) => this.isWithinBounds(p) && this.isWalkable(p));
    }

    isWithinBounds(pos) {
        return (
            pos.y >= 0 &&
            pos.y < this.maze.length &&
            pos.x >= 0 &&
            pos.x < this.maze[0].length
        );
    }

    isWalkable(pos) {
        const cell = this.maze[pos.y]?.[pos.x];
        return cell !== 1;
    }

    getPellets() {
        if (!this.maze) return [];

        const pellets = [];

        for (let y = 0; y < this.maze.length; y++) {
            for (let x = 0; x < this.maze[y].length; x++) {
                const cell = this.maze[y][x];
                if (cell === 2 || cell === 3) {
                    pellets.push({ x, y });
                }
            }
        }

        return pellets;
    }

    getPelletsWithinRadius(radius) {
        return this.getPellets().filter((pellet) => {
            const dx = Math.abs(pellet.x - this.pacman.x);
            const dy = Math.abs(pellet.y - this.pacman.y);
            return dx + dy <= radius;
        });
    }

    isPellet(pos) {
        if (!this.maze) return false;
        const cell = this.maze[pos.y]?.[pos.x];
        return cell === 2 || cell === 3;
    }

    consumePellet(pos) {
        if (this.isPellet(pos)) {
            this.maze[pos.y][pos.x] = 0;
        }
    }

    setPacmanRandomness(value) {
        this.pacmanRandomness = Math.min(1, Math.max(0, value));
    }

    getPacmanRandomness() {
        return this.pacmanRandomness;
    }

    setGhostStartDelay(value) {
        this.ghostStartDelay = Math.max(0, value);
    }

    getGhostStartDelay() {
        return this.ghostStartDelay;
    }

    setGhostCount(count) {
        const map = MAPS[this.currentMapName];
        if (!map) return;

        const maxGhosts = Math.min(4, map.ghosts?.length || 0);
        const clamped = Math.max(1, Math.min(count, maxGhosts || 1));

        if (clamped === this.ghostCount) return;

        this.stopLoop();
        this.ghostCount = clamped;
        this.loadMap(this.currentMapName);
    }

    getCollidingGhost() {
        return this.ghosts?.find(
            (ghost) => ghost.x === this.pacman.x && ghost.y === this.pacman.y
        );
    }

    getCurrentMapName() {
        return this.currentMapName;
    }

    getGhosts() {
        return this.ghosts.map((g) => ({ ...g }));
    }

    getGhostCount() {
        return this.ghostCount;
    }

    getVisualizingGhostId() {
        return this.visualizingGhostId;
    }

    getState() {
        return {
            maze: this.maze,
            pacman: this.pacman,
            ghosts: this.ghosts,
            visualizingGhostId: this.visualizingGhostId,
            lastPlan: this.lastPlan,
            isRunning: this.isRunning,
            tickSpeed: this.tickSpeed
        };
    }

    isPlaying() {
        return this.isRunning;
    }

    setTickSpeed(ms) {
        this.tickSpeed = ms;
        if (this.isRunning) {
            this.stopLoop();
            this.startLoop();
        }
    }

    startLoop() {
        if (this.gameLoopId !== null) return;
        this.isRunning = true;
        this.gameLoopId = setInterval(() => this.tick(), this.tickSpeed);
    }

    stopLoop() {
        if (this.gameLoopId !== null) {
            clearInterval(this.gameLoopId);
            this.gameLoopId = null;
        }
        this.isRunning = false;
    }

    togglePlay() {
        if (this.isRunning) {
            this.stopLoop();
        } else {
            this.startLoop();
        }
    }

    stepOnce() {
        if (!this.isRunning) {
            this.tick();
        }
    }

    reset() {
        this.loadMap(this.currentMapName);
    }

    changeGhostAlgorithm(ghostId, algorithm) {
        const ghost = this.ghosts.find((g) => g.id === ghostId);
        if (ghost) {
            ghost.algorithm = algorithm;
        }
    }

    setVisualizingGhost(ghostId) {
        if (this.visualizingGhostId === ghostId) {
            this.visualizingGhostId = null;
            this.lastPlan = null;
        } else {
            this.visualizingGhostId = ghostId;
            const ghost = this.ghosts.find((g) => g.id === ghostId);
            if (ghost) {
                const plan = runAlgorithm(
                    ghost.algorithm,
                    { x: ghost.x, y: ghost.y },
                    this.pacman,
                    this.maze,
                    this.ghosts
                );
                this.lastPlan = plan;
                this.onPlanComputed(ghost, plan);
            }
        }
        this.render();
    }

    tick() {
        if (!this.maze || !this.pacman || !this.ghosts) return;

        this.ticksElapsed += 1;
        this.movePacmanTowardsPellet();

        const initialCollision = this.getCollidingGhost();
        if (initialCollision) {
            this.stopLoop();
            this.onGhostCaught(initialCollision);
            this.render();
            return;
        }

        const ghostsCanMove = this.ticksElapsed > this.ghostStartDelay;

        for (const ghost of this.ghosts) {
            if (!ghostsCanMove) {
                if (this.visualizingGhostId === ghost.id) {
                    const plan = runAlgorithm(
                        ghost.algorithm,
                        { x: ghost.x, y: ghost.y },
                        this.pacman,
                        this.maze,
                        this.ghosts
                    );

                    this.lastPlan = plan;
                    this.onPlanComputed(ghost, plan);
                }
                continue;
            }

            const plan = runAlgorithm(
                ghost.algorithm,
                { x: ghost.x, y: ghost.y },
                this.pacman,
                this.maze,
                this.ghosts
            );

            if (this.visualizingGhostId === ghost.id) {
                this.lastPlan = plan;
                this.onPlanComputed(ghost, plan);
            }

            if (plan.nextMove) {
                ghost.x = plan.nextMove.x;
                ghost.y = plan.nextMove.y;
            }

            if (ghost.x === this.pacman.x && ghost.y === this.pacman.y) {
                this.stopLoop();
                this.onGhostCaught(ghost);
                break;
            }
        }

        this.render();
    }

    render() {
        if (this.renderer) {
            this.renderer.render(this.getState());
        }
    }
}
