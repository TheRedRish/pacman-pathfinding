import { CELL_SIZE } from "./maps.js";

export class Renderer {
    constructor(canvas, cellSize = CELL_SIZE) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.cellSize = cellSize;
    }

    resize(gridWidth, gridHeight) {
        this.canvas.width = gridWidth * this.cellSize;
        this.canvas.height = gridHeight * this.cellSize;
    }

    render(gameState) {
        const { maze, pacman, ghosts, visualizingGhostId, lastPlan } = gameState;

        if (!maze || !pacman || !ghosts) {
            return;
        }

        const ctx = this.ctx;

        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (lastPlan && visualizingGhostId !== null) {
            this.drawVisualization(lastPlan);
        }

        this.drawMaze(maze);
        this.drawPacman(pacman.x, pacman.y);
        ghosts.forEach((ghost) => this.drawGhost(ghost, visualizingGhostId === ghost.id));
    }

    drawMaze(maze) {
        const ctx = this.ctx;
        const size = this.cellSize;

        for (let y = 0; y < maze.length; y++) {
            for (let x = 0; x < maze[0].length; x++) {
                const cell = maze[y][x];

                if (cell === 1) {
                    ctx.fillStyle = "#0000ff";
                    ctx.fillRect(x * size, y * size, size, size);
                    ctx.strokeStyle = "#4444ff";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x * size, y * size, size, size);
                } else if (cell === 2) {
                    ctx.fillStyle = "#ffb852";
                    ctx.beginPath();
                    ctx.arc(
                        x * size + size / 2,
                        y * size + size / 2,
                        2,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                } else if (cell === 3) {
                    ctx.fillStyle = "#ffb852";
                    ctx.beginPath();
                    ctx.arc(
                        x * size + size / 2,
                        y * size + size / 2,
                        5,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
            }
        }
    }

    drawPacman(x, y) {
        const ctx = this.ctx;
        const size = this.cellSize;

        ctx.fillStyle = "#ffff00";
        ctx.beginPath();
        ctx.arc(
            x * size + size / 2,
            y * size + size / 2,
            size * 0.4,
            0.2 * Math.PI,
            1.8 * Math.PI
        );
        ctx.lineTo(x * size + size / 2, y * size + size / 2);
        ctx.fill();
    }

    drawGhost(ghost, isHighlighted) {
        const ctx = this.ctx;
        const size = this.cellSize;

        const x = ghost.x * size + size / 2;
        const y = ghost.y * size + size / 2;
        const r = size * 0.4;

        ctx.fillStyle = ghost.color;
        ctx.globalAlpha = isHighlighted ? 1 : 0.8;

        ctx.beginPath();
        ctx.arc(x, y - r * 0.2, r, Math.PI, 0, false);
        ctx.lineTo(x + r, y + r * 0.6);
        ctx.lineTo(x + r * 0.6, y + r * 0.3);
        ctx.lineTo(x + r * 0.2, y + r * 0.6);
        ctx.lineTo(x - r * 0.2, y + r * 0.3);
        ctx.lineTo(x - r * 0.6, y + r * 0.6);
        ctx.lineTo(x - r, y + r * 0.3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.25, 0, 2 * Math.PI);
        ctx.arc(x + r * 0.3, y - r * 0.2, r * 0.25, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = "#0000aa";
        ctx.beginPath();
        ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.12, 0, 2 * Math.PI);
        ctx.arc(x + r * 0.3, y - r * 0.2, r * 0.12, 0, 2 * Math.PI);
        ctx.fill();

        ctx.globalAlpha = 1;
    }

    drawVisualization(plan) {
        if (!plan) return;
        const ctx = this.ctx;
        const size = this.cellSize;

        if (plan.visited) {
            ctx.fillStyle = "rgba(100, 100, 255, 0.3)";
            plan.visited.forEach((pos) => {
                ctx.fillRect(pos.x * size, pos.y * size, size, size);
            });
        }

        if (plan.frontier && plan.frontier.length > 0) {
            ctx.fillStyle = "rgba(255, 255, 100, 0.4)";
            plan.frontier.forEach((pos) => {
                ctx.fillRect(pos.x * size, pos.y * size, size, size);
            });
        }

        if (plan.path && plan.path.length > 0) {
            ctx.strokeStyle = "rgba(255, 0, 255, 0.6)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            plan.path.forEach((pos, i) => {
                const x = pos.x * size + size / 2;
                const y = pos.y * size + size / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }
    }
}
