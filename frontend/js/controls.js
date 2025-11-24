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

        this.benchmarkTrialsInput = document.getElementById("benchmarkTrials");
        this.benchmarkNoteInput = document.getElementById("benchmarkNote");

        this.speedSlider = document.getElementById("speedSlider");
        this.speedValue = document.getElementById("speedValue");

        this.randomnessSlider = document.getElementById("randomnessSlider");
        this.randomnessValue = document.getElementById("randomnessValue");

        this.ghostCountSlider = document.getElementById("ghostCountSlider");
        this.ghostCountValue = document.getElementById("ghostCountValue");

        this.customMapWidthInput = document.getElementById("customMapWidth");
        this.customMapHeightInput = document.getElementById("customMapHeight");
        this.customPacmanXInput = document.getElementById("customPacmanX");
        this.customPacmanYInput = document.getElementById("customPacmanY");
        this.customGhostInputs = [
            { x: document.getElementById("customGhost1X"), y: document.getElementById("customGhost1Y") },
            { x: document.getElementById("customGhost2X"), y: document.getElementById("customGhost2Y") },
            { x: document.getElementById("customGhost3X"), y: document.getElementById("customGhost3Y") },
            { x: document.getElementById("customGhost4X"), y: document.getElementById("customGhost4Y") }
        ];
        this.btnGenerateCustomMap = document.getElementById("btnGenerateCustomMap");

        this.benchmarkResultsDiv = document.getElementById("benchmarkResults");
        this.benchmarkContent = document.getElementById("benchmarkContent");
        this.benchmarkProgress = document.getElementById("benchmarkProgress");
        this.benchmarkProgressBar = document.getElementById("benchmarkProgressBar");
        this.benchmarkProgressLabel = document.getElementById("benchmarkProgressLabel");

        this.backendStatusDiv = document.getElementById("backendStatus");
        this.backendConnected = false;

        this.lastBenchmarkResults = null;
        this.lastBenchmarkMap = null;
        this.lastBenchmarkConfig = null;
        this.benchmarkWorker = null;
        this.benchmarkResolve = null;
        this.benchmarkReject = null;

        this.ghostPathButtons = new Map();

        this.init();
    }

    init() {
        this.buildMapButtons();
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

        this.btnGenerateCustomMap?.addEventListener("click", () => {
            this.handleGenerateCustomMap();
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

    handleGenerateCustomMap() {
        const width = parseInt(this.customMapWidthInput?.value, 10);
        const height = parseInt(this.customMapHeightInput?.value, 10);

        if (!width || !height || width < 5 || height < 5) {
            alert("Please enter a width and height of at least 5.");
            return;
        }

        const mapData = this.generateRandomMapData(width, height);
        const pacman = this.parseCoordinate(this.customPacmanXInput, this.customPacmanYInput, width, height);
        const ghosts = this.getCustomGhosts(width, height);

        // Ensure characters spawn on walkable tiles
        if (mapData[pacman.y] && mapData[pacman.y][pacman.x] === 1) {
            mapData[pacman.y][pacman.x] = 2;
        }
        ghosts.forEach((ghost) => {
            if (mapData[ghost.y] && mapData[ghost.y][ghost.x] === 1) {
                mapData[ghost.y][ghost.x] = 2;
            }
        });

        const mapDefinition = {
            id: `builder-${Date.now()}`,
            name: `Custom ${width}x${height}`,
            width,
            height,
            pacman,
            ghosts,
            data: mapData,
        };

        const [mapKey] = registerCustomMaps([mapDefinition]);
        if (!mapKey) return;

        this.gameEngine.loadMap(mapKey);
        this.buildMapButtons();
        this.setActiveMapButton(mapKey);
        this.buildGhostControls();
        this.updateStatsPlaceholder();
        this.updatePlayButton(false);
        this.syncGhostCountFromEngine();
    }

    parseCoordinate(xInput, yInput, width, height) {
        const x = Math.min(width - 2, Math.max(1, parseInt(xInput?.value, 10) || 1));
        const y = Math.min(height - 2, Math.max(1, parseInt(yInput?.value, 10) || 1));
        return { x, y };
    }

    getCustomGhosts(width, height) {
        const templates = MAPS.classic?.ghosts ?? [];

        return templates.slice(0, 4).map((ghost, index) => {
            const inputs = this.customGhostInputs[index];
            const coords = this.parseCoordinate(inputs?.x, inputs?.y, width, height);
            return {
                ...ghost,
                x: coords.x,
                y: coords.y,
            };
        });
    }

    generateRandomMapData(width, height) {
        const wallChance = 0.18;

        return Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => {
                const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
                if (isBorder) return 1;

                const isWall = Math.random() < wallChance;
                return isWall ? 1 : 2; // Pellet everywhere else
            })
        );
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
                Click "Run Benchmark" to evaluate the current game settings without rendering.
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
        const mapName = this.gameEngine.getCurrentMapName();
        const trials = parseInt(this.benchmarkTrialsInput?.value, 10) || 10;
        const activeGhosts = this.gameEngine.getGhosts();

        if (!Number.isFinite(trials) || trials < 1) {
            alert("Trials must be a positive number.");
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
            const options = {
                trials,
                maxTicks: 500,
                pacmanRandomness: this.gameEngine.getPacmanRandomness(),
                ghostCount: this.gameEngine.getGhostCount(),
                ghostStartDelay: this.gameEngine.getGhostStartDelay(),
                ghostAlgorithms: activeGhosts.map((ghost) => ghost.algorithm),
            };

            const results = await this.runBenchmarkViaWorker(mapName, options);
            if (results) {
                this.lastBenchmarkResults = results;
                this.lastBenchmarkConfig = { mapName, ...options };
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

    runBenchmarkViaWorker(mapName, options = { trials: 10, maxTicks: 500 }) {
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
        const pacmanRandomness = this.lastBenchmarkConfig?.pacmanRandomness;

        let html = `<div class="benchmark-summary">
            <div><strong>Map:</strong> ${mapLabel}</div>
            <div><strong>Trials per algorithm:</strong> ${trials}</div>
            <div><strong>Algorithms:</strong> ${algorithms || "None"}</div>
            ${typeof pacmanRandomness === "number" ? `<div><strong>Pac-Man randomness:</strong> ${(pacmanRandomness * 100).toFixed(0)}%</div>` : ""}
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
            await saveBenchmarkResults(
                mapName,
                this.lastBenchmarkResults,
                this.lastBenchmarkConfig?.pacmanRandomness ?? this.gameEngine.getPacmanRandomness(),
                this.benchmarkNoteInput?.value || "",
            );
            alert("Benchmark results saved successfully!");
        } catch (err) {
            console.error(err);
            alert("Error: Failed to save benchmark results.");
        } finally {
            this.btnSaveBenchmark.disabled = false;
        }
    }
}
