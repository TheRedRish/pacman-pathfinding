import { MAPS, registerCustomMaps } from "./maps.js";
import { runBenchmark, saveBenchmarkResults } from "./benchmark.js";
import { fetchBackendHealth, fetchBenchmarkStats, fetchSavedMaps } from "./api.js";

export class UIController {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;

        this.mapSelector = document.getElementById("mapSelector");
        this.ghostControlsContainer = document.getElementById("ghostControls");
        this.statsDiv = document.getElementById("stats");

        this.btnPlay = document.getElementById("btnPlay");
        this.btnStep = document.getElementById("btnStep");
        this.btnReset = document.getElementById("btnReset");
        this.btnBenchmark = document.getElementById("btnBenchmark");
        this.btnSaveBenchmark = document.getElementById("btnSaveBenchmark");

        this.speedSlider = document.getElementById("speedSlider");
        this.speedValue = document.getElementById("speedValue");

        this.benchmarkResultsDiv = document.getElementById("benchmarkResults");
        this.benchmarkContent = document.getElementById("benchmarkContent");

        this.backendStatusDiv = document.getElementById("backendStatus");
        this.backendConnected = false;

        this.lastBenchmarkResults = null;

        this.ghostPathButtons = new Map();

        this.init();
    }

    init() {
        this.buildMapButtons();
        this.buildGhostControls();
        this.updateStatsPlaceholder();
        this.bindEvents();
        this.updatePlayButton(false);
        this.loadBackendData();
    }

    bindEvents() {
        this.btnPlay.addEventListener("click", () => {
            this.gameEngine.togglePlay();
            this.updatePlayButton(this.gameEngine.isPlaying());
        });

        this.btnStep.addEventListener("click", () => {
            this.gameEngine.stepOnce();
        });

        this.btnReset.addEventListener("click", () => {
            this.gameEngine.reset();
            this.buildGhostControls();
            this.updateStatsPlaceholder();
            this.updatePlayButton(false);
        });

        this.speedSlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value, 10);
            this.speedValue.textContent = value;
            this.gameEngine.setTickSpeed(value);
        });

        this.btnBenchmark.addEventListener("click", () => {
            this.handleRunBenchmark();
        });

        this.btnSaveBenchmark.addEventListener("click", () => {
            this.handleSaveBenchmark();
        });
    }

    buildMapButtons() {
        this.mapSelector.innerHTML = "";

        Object.entries(MAPS).forEach(([key, map]) => {
            const btn = document.createElement("button");
            btn.className = "map-button";
            btn.textContent = map.name;
            btn.dataset.mapName = key;

            if (key === this.gameEngine.getCurrentMapName()) {
                btn.classList.add("active");
            }

            btn.addEventListener("click", () => {
                this.gameEngine.loadMap(key);
                this.buildGhostControls();
                this.updateStatsPlaceholder();
                this.updatePlayButton(false);
                this.setActiveMapButton(key);
            });

            this.mapSelector.appendChild(btn);
        });
    }

    setActiveMapButton(mapName) {
        const buttons = this.mapSelector.querySelectorAll(".map-button");
        buttons.forEach((btn) => {
            if (btn.dataset.mapName === mapName) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
    }

    buildGhostControls() {
        this.ghostControlsContainer.innerHTML = "";
        this.ghostPathButtons.clear();
        const ghosts = this.gameEngine.getGhosts();

        ghosts.forEach((ghost) => {
            const div = document.createElement("div");
            div.className = "ghost-control";

            const header = document.createElement("div");
            header.className = "ghost-header";

            const colorDot = document.createElement("div");
            colorDot.className = "ghost-color";
            colorDot.style.background = ghost.color;

            const label = document.createElement("strong");
            label.textContent = ghost.name;

            header.appendChild(colorDot);
            header.appendChild(label);

            const select = document.createElement("select");
            select.id = `ghost${ghost.id}Algo`;

            const options = ["BFS", "DFS", "Dijkstra", "A*"];
            options.forEach((algo) => {
                const opt = document.createElement("option");
                opt.value = algo;
                opt.textContent = algo;
                if (ghost.algorithm === algo) opt.selected = true;
                select.appendChild(opt);
            });

            select.addEventListener("change", (e) => {
                this.gameEngine.changeGhostAlgorithm(ghost.id, e.target.value);
            });

            const btn = document.createElement("button");
            btn.textContent = "Show Path";
            btn.className = "ghost-path-btn";
            btn.dataset.ghostId = ghost.id;

            btn.addEventListener("click", () => {
                this.gameEngine.setVisualizingGhost(ghost.id);
                this.updateGhostPathButtons(this.gameEngine.getVisualizingGhostId());
            });

            div.appendChild(header);
            div.appendChild(select);
            div.appendChild(btn);

            this.ghostControlsContainer.appendChild(div);

            this.ghostPathButtons.set(ghost.id, btn);
        });

        this.updateGhostPathButtons(this.gameEngine.getVisualizingGhostId());
    }

    updateStatsPlaceholder() {
        this.statsDiv.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Algorithm:</span>
                <span class="stat-value">-</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Nodes Visited:</span>
                <span class="stat-value">-</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Time:</span>
                <span class="stat-value">-</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Path Length:</span>
                <span class="stat-value">-</span>
            </div>
        `;
    }

    updateStats(ghost, plan) {
        this.statsDiv.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Algorithm:</span>
                <span class="stat-value">${ghost.algorithm}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Nodes Visited:</span>
                <span class="stat-value">${plan.nodesVisited}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Time:</span>
                <span class="stat-value">${plan.timeMs.toFixed(3)}ms</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Path Length:</span>
                <span class="stat-value">${plan.path ? plan.path.length : 0}</span>
            </div>
        `;
    }

    updatePlayButton(isPlaying) {
        if (isPlaying) {
            this.btnPlay.textContent = "⏸ Pause";
            this.btnPlay.classList.remove("btn-play");
            this.btnPlay.classList.add("btn-pause");
        } else {
            this.btnPlay.textContent = "▶ Play";
            this.btnPlay.classList.remove("btn-pause");
            this.btnPlay.classList.add("btn-play");
        }
    }

    updateGhostPathButtons(activeGhostId) {
        this.ghostPathButtons.forEach((btn, id) => {
            const isActive = activeGhostId === id;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-pressed", isActive);
            btn.textContent = isActive ? "Hide Path" : "Show Path";
        });
    }

    handleGhostCaught(ghost) {
        this.updatePlayButton(false);
        alert(`${ghost.name} caught Pac-Man using ${ghost.algorithm}!`);
    }

    async handleRunBenchmark() {
        const mapName = this.gameEngine.getCurrentMapName();
        this.benchmarkResultsDiv.style.display = "block";
        this.benchmarkContent.innerHTML = `<div class="loading">Running benchmark... This may take a moment.</div>`;
        this.btnBenchmark.disabled = true;
        this.btnSaveBenchmark.disabled = true;

        try {
            const results = await runBenchmark(mapName, { trials: 10, maxTicks: 500 });
            this.lastBenchmarkResults = results;
            this.displayBenchmarkResults(results);
            this.btnSaveBenchmark.disabled = false;
        } catch (err) {
            console.error(err);
            this.benchmarkContent.innerHTML = `<div class="loading">Benchmark failed.</div>`;
        } finally {
            this.btnBenchmark.disabled = false;
        }
    }

    async loadBackendData() {
        if (!this.backendStatusDiv) return;

        this.backendStatusDiv.innerHTML = '<div class="loading">Connecting to backend...</div>';

        try {
            const [health, stats, savedMaps] = await Promise.all([
                fetchBackendHealth(),
                fetchBenchmarkStats(),
                fetchSavedMaps(),
            ]);

            if (Array.isArray(savedMaps) && savedMaps.length > 0) {
                registerCustomMaps(savedMaps);
                this.buildMapButtons();
            }

            this.backendConnected = true;
            this.renderBackendStatus({ health, stats, savedMaps });
        } catch (error) {
            console.error(error);
            this.backendStatusDiv.innerHTML = `
                <div class="stat-item">
                    <span class="stat-label">Status:</span>
                    <span class="stat-value">Offline</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Details:</span>
                    <span class="stat-value">${error.message}</span>
                </div>
            `;
        }
    }

    renderBackendStatus({ health, stats, savedMaps }) {
        const totalBenchmarks = stats?.totalBenchmarks || 0;
        const totalCustomMaps = Array.isArray(savedMaps) ? savedMaps.length : 0;

        this.backendStatusDiv.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Status:</span>
                <span class="stat-value">${health?.status ?? "Unknown"}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Benchmarks saved:</span>
                <span class="stat-value">${totalBenchmarks}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Custom maps:</span>
                <span class="stat-value">${totalCustomMaps}</span>
            </div>
        `;
    }

    displayBenchmarkResults(results) {
        let html = '<table class="benchmark-table"><thead><tr>';
        html += "<th>Algorithm</th>";
        html += "<th>Avg Time (ms)</th>";
        html += "<th>Avg Nodes</th>";
        html += "<th>Avg Ticks</th>";
        html += "<th>Success Rate</th>";
        html += "</tr></thead><tbody>";

        results.forEach((result) => {
            html += "<tr>";
            html += `<td><strong>${result.algorithm}</strong></td>`;
            html += `<td>${result.avgTimeMs.toFixed(4)}</td>`;
            html += `<td>${result.avgNodesVisited.toFixed(1)}</td>`;
            html += `<td>${result.avgTicksToCatch.toFixed(1)}</td>`;
            html += `<td>${(result.catchRate * 100).toFixed(0)}%</td>`;
            html += "</tr>";
        });

        html += "</tbody></table>";
        this.benchmarkContent.innerHTML = html;
    }

    async handleSaveBenchmark() {
        if (!this.lastBenchmarkResults) {
            alert("No benchmark results to save!");
            return;
        }

        try {
            await saveBenchmarkResults(
                this.gameEngine.getCurrentMapName(),
                this.lastBenchmarkResults
            );
            alert("Benchmark results saved successfully!");
        } catch (err) {
            console.error(err);
            alert("Error: Failed to save benchmark results.");
        }
    }
}
