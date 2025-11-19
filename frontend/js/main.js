import { GameEngine } from "./game.js";
import { UIController } from "./controls.js";

window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("gameCanvas");
    const gameEngine = new GameEngine(canvas);
    const ui = new UIController(gameEngine);

    gameEngine.setCallbacks({
        onPlanComputed: (ghost, plan) => ui.updateStats(ghost, plan),
        onGhostCaught: (ghost) => ui.handleGhostCaught(ghost)
    });
});
