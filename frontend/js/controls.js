import { ALGORITHM_NAMES } from "./algorithms.js";
import { MAPS, registerCustomMaps } from "./maps.js";
import { saveBenchmarkResults } from "./benchmark.js";
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

        this.benchmarkMapSelect = document.getElementById("benchmarkMap");
        this.benchmarkTrialsInput = document.getElementById("benchmarkTrials");
        this.benchmarkAlgorithmsContainer = document.getElementById("benchmarkAlgorithms");

        this.speedSlider = document.getElementById("speedSlider");
        this.speedValue = document.getElementById("speedValue");

        this.randomnessSlider = document.getElementById("randomnessSlider");
        this.randomnessValue = document.getElementById("randomnessValue");

        this.ghostCountSlider = document.getElementById("ghostCountSlider");
        this.ghostCountValue = document.getElementById("ghostCountValue");

        this.benchmarkResultsDiv = document.getElementById("benchmarkResults");
        this.benchmarkContent = document.getElementById("benchmarkContent");
        this.benchmarkProgress = document.getElementById("benchmarkProgress");
        this.benchmarkProgressBar = document.getElementById("benchmarkProgressBar");
        this.benchmarkProgressLabel = document.getElementById("benchmarkProgressLabel");

        this.backendStatusDiv = document.getElementById("backendStatus");
        this.backendConnected = false;

        this.lastBenchmarkResults = null;
        this.lastBenchmarkMap = null;
        this.benchmarkWorker = null;
        this.benchmarkResolve = null;
        this.benchmarkReject = null;

        this.ghostPathButtons = new Map();

        this.init();
    }

    init() {
        this.buildMapButtons();
        this.buildBenchmarkControls();
        this.buildGhostControls();
        this.updateStatsPlaceholder();
        this.updateBenchmarkPlaceholder();
        this.bindEvents();
        this.updatePlayButton(false);
        this.loadBackendData();

        this.initializeRandomness();
        this.initializeGhostCount();
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
            this.syncGhostCountFromEngine();
        });

        this.speedSlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value, 10);
            this.speedValue.textContent = value;
            this.gameEngine.setTickSpeed(value);
        });

        this.randomnessSlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value, 10);
            this.randomnessValue.textContent = value;
            this.gameEngine.setPacmanRandomness(value / 100);
        });

        this.ghostCountSlider.addEventListener("input", (e) => {
            const value = parseInt(e.target.value, 10);
            this.ghostCountValue.textContent = value;
            this.gameEngine.setGhostCount(value);
            this.syncGhostCountFromEngine();
            this.buildGhostControls();
            this.updateStatsPlaceholder();
            this.updatePlayButton(false);
        });

        this.btnBenchmark.addEventListener("click", () => {
            this.handleRunBenchmark();
        });

        this.btnSaveBenchmark.addEventListener("click", () => {
            this.handleSaveBenchmark();
        });
    }

    initializeRandomness() {
        if (!this.randomnessSlider || !this.randomnessValue) return;

        const value = parseInt(this.randomnessSlider.value, 10) || 0;
        this.randomnessValue.textContent = value;
        this.gameEngine.setPacmanRandomness(value / 100);
    }

    initializeGhostCount() {
        if (!this.ghostCountSlider || !this.ghostCountValue) return;

        this.syncGhostCountFromEngine();
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
                this.syncGhostCountFromEngine();
                this.setActiveMapButton(key);
            });

            this.mapSelector.appendChild(btn);
        });

        this.syncBenchmarkMapSelection();
    }

    buildBenchmarkControls() {
        this.buildBenchmarkMapOptions();
        this.buildBenchmarkAlgorithmOptions();
        this.syncBenchmarkMapSelection();
    }

    buildBenchmarkMapOptions() {
        if (!this.benchmarkMapSelect) return;

        this.benchmarkMapSelect.innerHTML = "";

        Object.entries(MAPS).forEach(([key, map]) => {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = map.name;
            this.benchmarkMapSelect.appendChild(option);
        });
    }

    buildBenchmarkAlgorithmOptions() {
        if (!this.benchmarkAlgorithmsContainer) return;

        this.benchmarkAlgorithmsContainer.innerHTML = "";

        ALGORITHM_NAMES.forEach((algo) => {
            const label = document.createElement("label");
            label.className = "checkbox-pill";

            const input = document.createElement("input");
            input.type = "checkbox";
            input.value = algo;
            input.checked = true;

            const text = document.createElement("span");
            text.textContent = algo;

            label.appendChild(input);
            label.appendChild(text);

            this.benchmarkAlgorithmsContainer.appendChild(label);
        });
    }

    getSelectedBenchmarkAlgorithms() {
        if (!this.benchmarkAlgorithmsContainer) return ALGORITHM_NAMES;

        const checked = Array.from(
            this.benchmarkAlgorithmsContainer.querySelectorAll("input[type='checkbox']")
        )
            .filter((input) => input.checked)
            .map((input) => input.value);

        return checked;
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

        this.syncBenchmarkMapSelection(mapName);
    }

    syncBenchmarkMapSelection(mapName = this.gameEngine.getCurrentMapName()) {
        if (!this.benchmarkMapSelect) return;

        if (mapName) {
            this.benchmarkMapSelect.value = mapName;
        }
    }

    syncGhostCountFromEngine() {
        if (!this.ghostCountSlider || !this.ghostCountValue) return;

        const mapGhosts = MAPS[this.gameEngine.getCurrentMapName()]?.ghosts?.length || 4;
        this.ghostCountSlider.max = Math.min(4, mapGhosts);

        const count = this.gameEngine.getGhostCount();
        this.ghostCountSlider.value = count;
        this.ghostCountValue.textContent = count;
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

    updateBenchmarkPlaceholder() {
        if (!this.benchmarkContent) return;

        this.benchmarkContent.innerHTML = `
            <div class="loading">
                Configure the benchmark and click "Run Benchmark" to see results.
            </div>
        `;

        if (this.btnSaveBenchmark) {
            this.btnSaveBenchmark.disabled = true;
        }
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
        const mapName = this.benchmarkMapSelect?.value || this.gameEngine.getCurrentMapName();
        const trials = parseInt(this.benchmarkTrialsInput?.value, 10) || 10;
        const algorithms = this.getSelectedBenchmarkAlgorithms();

        if (!mapName) {
            alert("Please select a map to benchmark.");
            return;
        }

        if (!Number.isFinite(trials) || trials < 1) {
            alert("Trials must be a positive number.");
            return;
        }

        if (algorithms.length === 0) {
            alert("Select at least one algorithm to benchmark.");
            return;
        }

        this.lastBenchmarkMap = mapName;
        this.benchmarkResultsDiv.style.display = "block";
        this.benchmarkContent.innerHTML = `<div class="loading">Running benchmark on ${MAPS[mapName]?.name ?? mapName}...</div>`;
        this.btnBenchmark.disabled = true;
        this.btnSaveBenchmark.disabled = true;
        this.updateBenchmarkProgress(0, "Starting benchmark...");
        this.toggleBenchmarkProgress(true);

        try {
            const results = await this.runBenchmarkViaWorker(mapName, {
                trials,
                maxTicks: 500,
                algorithms,
            });
            if (results) {
                this.lastBenchmarkResults = results;
                this.displayBenchmarkResults(results);
                this.btnSaveBenchmark.disabled = false;
            }
        } catch (err) {
            console.error(err);
            this.benchmarkContent.innerHTML = `<div class="loading">Benchmark failed.</div>`;
        } finally {
            this.toggleBenchmarkProgress(false);
            this.btnBenchmark.disabled = false;
        }
    }

    ensureBenchmarkWorker() {
        if (this.benchmarkWorker) return;

        this.benchmarkWorker = new Worker(new URL("./benchmarkWorker.js", import.meta.url), {
            type: "module",
        });

        this.benchmarkWorker.onmessage = (event) => this.handleBenchmarkMessage(event);
    }

    handleBenchmarkMessage(event) {
        const { type, progress, results, message } = event.data;

        if (type === "progress") {
            this.updateBenchmarkProgress(progress, "Benchmark in progress...");
            return;
        }

        if (type === "result") {
            this.updateBenchmarkProgress(1, "Benchmark complete!");
            if (this.benchmarkResolve) this.benchmarkResolve(results);
            this.clearBenchmarkPromise();
            return;
        }

        if (type === "error") {
            this.benchmarkContent.innerHTML = `<div class="loading">Benchmark failed: ${message}</div>`;
            if (this.benchmarkReject) this.benchmarkReject(new Error(message));
            this.clearBenchmarkPromise();
        }
    }

    clearBenchmarkPromise() {
        this.benchmarkResolve = null;
        this.benchmarkReject = null;
    }

    runBenchmarkViaWorker(mapName, options = { trials: 10, maxTicks: 500, algorithms: ALGORITHM_NAMES }) {
        this.ensureBenchmarkWorker();

        return new Promise((resolve, reject) => {
            this.benchmarkResolve = resolve;
            this.benchmarkReject = reject;

            this.benchmarkWorker.postMessage({
                mapName,
                options,
            });
        });
    }

    toggleBenchmarkProgress(show) {
        if (!this.benchmarkProgress) return;
        this.benchmarkProgress.style.display = show ? "block" : "none";
    }

    updateBenchmarkProgress(progress, labelText = "") {
        if (!this.benchmarkProgressBar || !this.benchmarkProgressLabel) return;

        const percentage = Math.min(100, Math.max(0, Math.round(progress * 100)));
        this.benchmarkProgressBar.style.width = `${percentage}%`;
        this.benchmarkProgressLabel.textContent = labelText || `Progress: ${percentage}%`;
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
                this.buildBenchmarkMapOptions();
                this.syncBenchmarkMapSelection();
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
        const trialsInput = this.benchmarkTrialsInput?.value;
        const trials = results?.[0]?.trials ?? (trialsInput ? Number(trialsInput) : 0);
        const mapName = results?.[0]?.mapName ?? this.lastBenchmarkMap;
        const mapLabel = mapName ? MAPS[mapName]?.name ?? mapName : "Unknown map";
        const algorithms = results.map((result) => result.algorithm).join(", ");

        let html = `<div class="benchmark-summary">
            <div><strong>Map:</strong> ${mapLabel}</div>
            <div><strong>Trials per algorithm:</strong> ${trials}</div>
            <div><strong>Algorithms:</strong> ${algorithms || "None"}</div>
        </div>`;

        html += '<table class="benchmark-table"><thead><tr>';
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

        const mapName = this.lastBenchmarkMap || this.gameEngine.getCurrentMapName();

        if (!mapName) {
            alert("Select a map before saving benchmark results.");
            return;
        }

        try {
            this.btnSaveBenchmark.disabled = true;
            await saveBenchmarkResults(mapName, this.lastBenchmarkResults);
            alert("Benchmark results saved successfully!");
        } catch (err) {
            console.error(err);
            alert("Error: Failed to save benchmark results.");
        } finally {
            this.btnSaveBenchmark.disabled = false;
        }
    }
}
