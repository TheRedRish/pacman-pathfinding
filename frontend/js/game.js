import { MAPS } from "./maps.js";
import { runAlgorithm } from "./algorithms.js";
import { Renderer } from "./rendering.js";

export class GameEngine {
    constructor(canvas) {
        this.renderer = new Renderer(canvas);
        this.currentMapName = "classic";
        this.maze = null;
        this.pacman = null;
        this.ghosts = null;
        this.visualizingGhostId = null;
        this.lastPlan = null;
        this.isRunning = false;
        this.tickSpeed = 200;
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

        const existingGhosts = this.ghosts || [];
        this.ghosts = map.ghosts.map((g) => {
            const existing = existingGhosts.find((eg) => eg.id === g.id);
            return {
                ...g,
                algorithm: existing ? existing.algorithm : g.algorithm
            };
        });

        this.visualizingGhostId = null;
        this.lastPlan = null;

        this.renderer.resize(map.width, map.height);
        this.render();
    }

    getCurrentMapName() {
        return this.currentMapName;
    }

    getGhosts() {
        return this.ghosts.map((g) => ({ ...g }));
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
        }
        this.render();
    }

    tick() {
        if (!this.maze || !this.pacman || !this.ghosts) return;

        for (const ghost of this.ghosts) {
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
        this.renderer.render(this.getState());
    }
}
