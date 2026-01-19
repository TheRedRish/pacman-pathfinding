import { MAPS, registerCustomMaps } from "./maps.js";
import { saveBenchmarkResults } from "./benchmark.js";
import { fetchBackendHealth, fetchBenchmarkStats, fetchSavedMaps, saveCustomMap } from "./api.js";

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

        this.customMapNameInput = document.getElementById("customMapName");
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
        this.btnApplySpawns = document.getElementById("btnApplySpawns");
        this.btnSaveCustomMap = document.getElementById("btnSaveCustomMap");

        this.lastCustomLayout = null;
        this.lastCustomDimensions = null;
        this.lastCustomMapId = null;
        this.lastCustomMapKey = null;

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

        this.btnApplySpawns?.addEventListener("click", () => {
            this.applyCustomSpawns();
        });

        this.btnSaveCustomMap?.addEventListener("click", () => {
            this.handleSaveCustomMap();
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
                this.syncCustomMapBuilder(key);
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

    syncCustomMapBuilder(mapKey) {
        if (!mapKey?.startsWith("custom-")) return;

        const map = MAPS[mapKey];
        if (!map?.data?.length) return;

        const width = map.width ?? map.data[0]?.length ?? 0;
        const height = map.height ?? map.data.length ?? 0;

        this.lastCustomLayout = this.cloneMapData(map.data);
        this.lastCustomDimensions = { width, height };
        this.lastCustomMapKey = mapKey;
        this.lastCustomMapId = mapKey.slice("custom-".length);

        if (this.customMapNameInput) this.customMapNameInput.value = map.name || "";
        if (this.customMapWidthInput) this.customMapWidthInput.value = width || "";
        if (this.customMapHeightInput) this.customMapHeightInput.value = height || "";

        const pacman = map.pacman || { x: 1, y: 1 };
        if (this.customPacmanXInput) this.customPacmanXInput.value = pacman.x ?? 1;
        if (this.customPacmanYInput) this.customPacmanYInput.value = pacman.y ?? 1;

        const ghosts = Array.isArray(map.ghosts) ? map.ghosts : [];
        this.customGhostInputs.forEach((inputs, index) => {
            const ghost = ghosts[index];
            if (inputs?.x) inputs.x.value = ghost?.x ?? 1;
            if (inputs?.y) inputs.y.value = ghost?.y ?? 1;
        });
    }

    handleGenerateCustomMap() {
        const width = parseInt(this.customMapWidthInput?.value, 10);
        const height = parseInt(this.customMapHeightInput?.value, 10);

        if (!width || !height || width < 5 || height < 5) {
            alert("Please enter a width and height of at least 5.");
            return;
        }
        this.lastCustomLayout = this.generateLabyrinthMapData(width, height);
        this.lastCustomDimensions = { width, height };
        this.lastCustomMapId = this.lastCustomMapId || `builder-${Date.now()}`;

        const defaultName = this.customMapNameInput?.value?.trim()
            || `Custom ${width}x${height} Labyrinth`;
        if (this.customMapNameInput) {
            this.customMapNameInput.value = defaultName;
        }

        this.applyCustomSpawns();
    }

    parseCoordinate(xInput, yInput, width, height) {
        const x = Math.min(width - 2, Math.max(1, parseInt(xInput?.value, 10) || 1));
        const y = Math.min(height - 2, Math.max(1, parseInt(yInput?.value, 10) || 1));
        return { x, y };
    }

    getCustomGhosts(width, height, mapData) {
        const templates = MAPS.classic?.ghosts ?? [];

        return templates.slice(0, 4).map((ghost, index) => {
            const inputs = this.customGhostInputs[index];
            const coords = this.ensureWalkableCoordinate(
                this.parseCoordinate(inputs?.x, inputs?.y, width, height),
                mapData,
            );
            return {
                ...ghost,
                x: coords.x,
                y: coords.y,
            };
        });
    }

    generateLabyrinthMapData(width, height) {
        const grid = Array.from({ length: height }, (_, y) =>
            Array.from({ length: width }, (_, x) => (x === 0 || y === 0 || x === width - 1 || y === height - 1 ? 1 : 1)),
        );

        const shuffleDirections = (dirs) => dirs.sort(() => Math.random() - 0.5);

        const carve = (cx, cy) => {
            const directions = [
                [0, -2],
                [0, 2],
                [-2, 0],
                [2, 0],
            ];

            shuffleDirections(directions);

            directions.forEach(([dx, dy]) => {
                const nx = cx + dx;
                const ny = cy + dy;

                if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) return;
                if (grid[ny][nx] !== 1) return;

                grid[cy + dy / 2][cx + dx / 2] = 0;
                grid[ny][nx] = 0;
                carve(nx, ny);
            });
        };

        // Start carving from the top-left interior cell
        grid[1][1] = 0;
        carve(1, 1);

        // Add a few random loops to reduce dead-ends and create a better labyrinth
        const extraPassages = Math.floor((width * height) / 30);
        for (let i = 0; i < extraPassages; i++) {
            const x = 2 + Math.floor(Math.random() * Math.max(1, width - 4));
            const y = 2 + Math.floor(Math.random() * Math.max(1, height - 4));
            if (grid[y][x] === 1) {
                grid[y][x] = 0;
            }
        }

        const neighbors = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];

        const connectDeadEnds = () => {
            const deadEnds = [];

            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    if (grid[y][x] !== 0) continue;

                    const openCount = neighbors.reduce((count, [dx, dy]) => {
                        return count + (grid[y + dy]?.[x + dx] === 0 ? 1 : 0);
                    }, 0);

                    if (openCount === 1) {
                        deadEnds.push({ x, y });
                    }
                }
            }

            shuffleDirections(deadEnds);

            deadEnds.forEach(({ x, y }) => {
                const options = neighbors
                    .filter(([dx, dy]) => grid[y + dy]?.[x + dx] === 1 && grid[y + dy * 2]?.[x + dx * 2] === 0)
                    .sort(() => Math.random() - 0.5);

                const choice = options[0];
                if (!choice) return;

                const [dx, dy] = choice;
                grid[y + dy][x + dx] = 0;
            });
        };

        connectDeadEnds();

        return grid.map((row) => row.map((cell) => (cell === 1 ? 1 : 2)));
    }

    cloneMapData(data) {
        return data.map((row) => [...row]);
    }

    ensureWalkableCoordinate(coord, mapData) {
        if (!mapData?.length) return coord;

        const height = mapData.length;
        const width = mapData[0].length;

        if (mapData[coord.y]?.[coord.x] !== 1) return coord;

        const directions = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];

        const queue = [[coord.x, coord.y, 0]];
        const visited = new Set([`${coord.x},${coord.y}`]);

        while (queue.length) {
            const [x, y, dist] = queue.shift();
            if (mapData[y]?.[x] !== 1) {
                return { x, y };
            }

            if (dist > Math.max(width, height)) break;

            directions.forEach(([dx, dy]) => {
                const nx = x + dx;
                const ny = y + dy;
                const key = `${nx},${ny}`;
                if (nx <= 0 || ny <= 0 || nx >= width - 1 || ny >= height - 1) return;
                if (visited.has(key)) return;
                visited.add(key);
                queue.push([nx, ny, dist + 1]);
            });
        }

        return coord;
    }

    buildCustomMapDefinition() {
        if (!this.lastCustomLayout || !this.lastCustomDimensions) {
            alert("Generate a labyrinth first.");
            return null;
        }

        const { width, height } = this.lastCustomDimensions;
        const mapData = this.cloneMapData(this.lastCustomLayout);

        const pacman = this.ensureWalkableCoordinate(
            this.parseCoordinate(this.customPacmanXInput, this.customPacmanYInput, width, height),
            mapData,
        );
        const ghosts = this.getCustomGhosts(width, height, mapData);

        if (mapData[pacman.y]?.[pacman.x] === 1) mapData[pacman.y][pacman.x] = 2;
        ghosts.forEach((ghost) => {
            if (mapData[ghost.y]?.[ghost.x] === 1) mapData[ghost.y][ghost.x] = 2;
        });

        const name = this.customMapNameInput?.value?.trim() || `Custom ${width}x${height} Labyrinth`;

        return {
            id: this.lastCustomMapId || `builder-${Date.now()}`,
            name,
            width,
            height,
            pacman,
            ghosts,
            data: mapData,
        };
    }

    applyCustomSpawns() {
        const mapDefinition = this.buildCustomMapDefinition();
        if (!mapDefinition) return null;

        const [mapKey] = registerCustomMaps([mapDefinition]);
        if (!mapKey) return null;

        this.lastCustomMapId = mapDefinition.id;
        this.lastCustomMapKey = mapKey;

        this.gameEngine.loadMap(mapKey);
        this.buildMapButtons();
        this.setActiveMapButton(mapKey);
        this.buildGhostControls();
        this.updateStatsPlaceholder();
        this.updatePlayButton(false);
        this.syncGhostCountFromEngine();

        return mapDefinition;
    }

    async handleSaveCustomMap() {
        const mapDefinition = this.applyCustomSpawns();
        if (!mapDefinition) return;

        try {
            this.btnSaveCustomMap.disabled = true;
            const response = await saveCustomMap(mapDefinition);
            if (response?.id) {
                alert("Map saved successfully!");
            }
        } catch (error) {
            console.error(error);
            alert("Failed to save map. Please try again.");
        } finally {
            this.btnSaveCustomMap.disabled = false;
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
                maxTicks: 2000,
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

    runBenchmarkViaWorker(mapName, options = { trials: 10, maxTicks: 2000 }) {
        this.ensureBenchmarkWorker();

        const mapDefinition = MAPS[mapName];

        return new Promise((resolve, reject) => {
            this.benchmarkResolve = resolve;
            this.benchmarkReject = reject;

            this.benchmarkWorker.postMessage({
                mapName,
                mapDefinition,
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
