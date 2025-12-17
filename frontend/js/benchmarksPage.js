import { fetchBenchmarks } from "./api.js";
import { MAPS } from "./maps.js";

const mapFilter = document.getElementById("mapFilter");
const limitInput = document.getElementById("limitInput");
const refreshButton = document.getElementById("refreshButton");
const tableBody = document.getElementById("benchmarkTableBody");
const statusTag = document.getElementById("statusTag");
const comparisonIntro = document.getElementById("comparisonIntro");
const comparisonContainer = document.getElementById("comparisonContainer");
const selectedBenchmarksEl = document.getElementById("selectedBenchmarks");

const BAR_COLORS = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24", "#f472b6", "#22d3ee", "#f97316"];

let benchmarks = [];
const selectedIds = new Set();

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function formatMapName(mapKey) {
    return MAPS[mapKey]?.name || mapKey || "Unknown map";
}

function formatAlgorithms(results = []) {
    return results.map((r) => r.algorithm).join(", ");
}

function getSelectedBenchmarks() {
    return benchmarks.filter((b) => selectedIds.has(b.id));
}

function getBarColor(index) {
    return BAR_COLORS[index % BAR_COLORS.length];
}

function renderMapOptions(extraMaps = []) {
    const uniqueMaps = new Set(["all", ...Object.keys(MAPS), ...extraMaps]);
    mapFilter.innerHTML = "";

    uniqueMaps.forEach((mapKey) => {
        const option = document.createElement("option");
        option.value = mapKey;
        option.textContent = mapKey === "all" ? "All maps" : formatMapName(mapKey);
        mapFilter.appendChild(option);
    });
}

function renderTable() {
    if (!benchmarks.length) {
        tableBody.innerHTML = `<tr><td colspan="6">No benchmarks found.</td></tr>`;
        return;
    }

    const sorted = [...benchmarks].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    tableBody.innerHTML = "";

    sorted.forEach((benchmark) => {
        const row = document.createElement("tr");

        const selectCell = document.createElement("td");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = selectedIds.has(benchmark.id);
        checkbox.addEventListener("change", (e) => {
            if (e.target.checked) {
                selectedIds.add(benchmark.id);
            } else {
                selectedIds.delete(benchmark.id);
            }
            renderSelection();
        });
        selectCell.appendChild(checkbox);

        const noteCell = document.createElement("td");
        noteCell.innerHTML = benchmark.note
            ? `<span class="benchmark-note">${benchmark.note}</span>`
            : "<em>No note</em>";

        const mapCell = document.createElement("td");
        mapCell.textContent = formatMapName(benchmark.mapName);

        const randomnessCell = document.createElement("td");
        randomnessCell.textContent = `${Math.round((benchmark.pacmanRandomness ?? 0) * 100)}%`;

        const timestampCell = document.createElement("td");
        timestampCell.textContent = formatTimestamp(benchmark.timestamp);

        const algorithmsCell = document.createElement("td");
        algorithmsCell.textContent = formatAlgorithms(benchmark.results);

        row.appendChild(selectCell);
        row.appendChild(noteCell);
        row.appendChild(mapCell);
        row.appendChild(randomnessCell);
        row.appendChild(timestampCell);
        row.appendChild(algorithmsCell);

        tableBody.appendChild(row);
    });
}

function renderSelection() {
    const selected = getSelectedBenchmarks();
    selectedBenchmarksEl.innerHTML = "";

    if (!selected.length) {
        comparisonIntro.textContent = "Select two or more benchmarks to compare their results side by side.";
        comparisonContainer.innerHTML = "";
        return;
    }

    comparisonIntro.textContent = `${selected.length} benchmark${selected.length === 1 ? "" : "s"} selected. Choose multiple to unlock comparison.`;

    selected.forEach((benchmark) => {
        const card = document.createElement("div");
        card.className = "comparison-card";
        card.innerHTML = `
            <div class="benchmark-note">${benchmark.note || "No note"}</div>
            <div class="about-text">${formatMapName(benchmark.mapName)} -> ${Math.round((benchmark.pacmanRandomness ?? 0) * 100)}% randomness</div>
            <div class="about-text">${formatTimestamp(benchmark.timestamp)}</div>
            <div class="about-text">Algorithms: ${formatAlgorithms(benchmark.results)}</div>
        `;
        selectedBenchmarksEl.appendChild(card);
    });

    renderComparison(selected);
}

function renderComparison(selected) {
    if (selected.length < 2) {
        comparisonContainer.innerHTML = "<div class=\"about-text\">Add at least two benchmarks to see a comparison table.</div>";
        return;
    }

    const comparisonWrap = document.createElement("div");
    comparisonWrap.className = "comparison-stack";

    const summarySection = document.createElement("section");
    summarySection.className = "comparison-section";
    summarySection.innerHTML = `
        <h4>Algorithm comparison</h4>
        <p class="about-text">Visualize planning time changes between algorithms across your selected runs.</p>
    `;
    summarySection.appendChild(renderAlgorithmBarChart(selected));
    summarySection.appendChild(renderAlgorithmSummary(selected));

    const detailSection = document.createElement("section");
    detailSection.className = "comparison-section";
    detailSection.innerHTML = `
        <h4>Benchmark details</h4>
        <p class="about-text">Per-benchmark breakdowns to see each run in context.</p>
    `;
    detailSection.appendChild(renderBenchmarkDetailTable(selected));

    comparisonWrap.appendChild(summarySection);
    comparisonWrap.appendChild(detailSection);

    comparisonContainer.innerHTML = "";
    comparisonContainer.appendChild(comparisonWrap);
}

function renderAlgorithmBarChart(selected) {
    const benchmarkLabels = selected.map((bench) => benchmarkLabel(bench));
    const algorithmData = new Map();

    selected.forEach((bench, benchIndex) => {
        (bench.results || []).forEach((result) => {
            if (!algorithmData.has(result.algorithm)) {
                algorithmData.set(result.algorithm, Array(selected.length).fill(null));
            }
            algorithmData.get(result.algorithm)[benchIndex] = result;
        });
    });

    if (!algorithmData.size) {
        const empty = document.createElement("div");
        empty.className = "about-text";
        empty.textContent = "No algorithm results available to plot.";
        return empty;
    }

    const maxTime = Math.max(
        0,
        ...Array.from(algorithmData.values()).flatMap((entries) =>
            entries.filter(Boolean).map((entry) => entry.avgTimeMs || 0)
        )
    );

    const fastestByBenchmark = selected.map(() => Infinity);
    algorithmData.forEach((entries) => {
        entries.forEach((entry, index) => {
            if (entry && entry.avgTimeMs < fastestByBenchmark[index]) {
                fastestByBenchmark[index] = entry.avgTimeMs;
            }
        });
    });

    const chart = document.createElement("div");
    chart.className = "algo-chart";

    const legend = document.createElement("div");
    legend.className = "chart-legend";
    benchmarkLabels.forEach((label, index) => {
        const legendItem = document.createElement("div");
        legendItem.className = "legend-item";
        legendItem.innerHTML = `
            <span class="legend-swatch" style="background:${getBarColor(index)}"></span>
            <span>${label}</span>
        `;
        legend.appendChild(legendItem);
    });
    chart.appendChild(legend);

    const rows = document.createElement("div");
    rows.className = "chart-rows";

    Array.from(algorithmData.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([algorithm, entries]) => {
            const row = document.createElement("div");
            row.className = "chart-row";

            const label = document.createElement("div");
            label.className = "chart-row-label";
            label.textContent = algorithm;
            row.appendChild(label);

            const bars = document.createElement("div");
            bars.className = "chart-bars";

            entries.forEach((entry, benchIndex) => {
                const value = entry?.avgTimeMs ?? 0;
                const width = maxTime > 0 && value > 0 ? Math.max((value / maxTime) * 100, 6) : 0;

                const bar = document.createElement("div");
                bar.className = "chart-bar";
                bar.title = entry
                    ? `${benchmarkLabels[benchIndex]} - ${value.toFixed(3)} ms`
                    : `${benchmarkLabels[benchIndex]} - Not run`;

                const fill = document.createElement("div");
                fill.className = "chart-bar-fill";
                fill.style.width = `${width}%`;
                fill.style.backgroundColor = entry ? getBarColor(benchIndex) : "transparent";

                const delta = entry && fastestByBenchmark[benchIndex] !== Infinity
                    ? entry.avgTimeMs - fastestByBenchmark[benchIndex]
                    : null;

                const barLabel = document.createElement("div");
                barLabel.className = "chart-bar-label";
                barLabel.textContent = entry
                    ? `${value.toFixed(3)} ms${delta && delta > 0.005 ? ` (+${delta.toFixed(3)} ms)` : " (fastest)"}`
                    : "Not run";

                bar.appendChild(fill);
                bar.appendChild(barLabel);
                bars.appendChild(bar);
            });

            row.appendChild(bars);
            rows.appendChild(row);
        });

    chart.appendChild(rows);
    return chart;
}

function renderAlgorithmSummary(selected) {
    const algorithmNames = new Set();
    selected.forEach((b) => b.results?.forEach((r) => algorithmNames.add(r.algorithm)));

    const table = document.createElement("table");
    table.className = "comparison-table compact";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headRow.innerHTML = `<th>Algorithm</th>${selected.map((b) => `<th>${benchmarkLabel(b)}</th>`).join("")}`;
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    Array.from(algorithmNames)
        .sort((a, b) => a.localeCompare(b))
        .forEach((algo) => {
        const row = document.createElement("tr");
        const algoCell = document.createElement("td");
        algoCell.textContent = algo;
        row.appendChild(algoCell);

        selected.forEach((bench) => {
            const cell = document.createElement("td");
            const result = bench.results?.find((r) => r.algorithm === algo);
            if (result) {
                cell.innerHTML = `
                    <div class="pill"><span>Avg Time:</span><strong>${result.avgTimeMs.toFixed(3)}ms</strong></div>
                    <div class="pill"><span>Avg Nodes:</span><strong>${result.avgNodesVisited.toFixed(1)}</strong></div>
                    <div class="pill"><span>Avg Ticks:</span><strong>${result.avgTicksToCatch.toFixed(1)}</strong></div>
                    <div class="pill"><span>Catch:</span><strong>${(result.catchRate * 100).toFixed(0)}%</strong></div>
                `;
            } else {
                cell.innerHTML = "<em>Not run</em>";
            }
            row.appendChild(cell);
        });

        tbody.appendChild(row);
    });

    if (!tbody.children.length) {
        const empty = document.createElement("tr");
        empty.innerHTML = `<td colspan="${selected.length + 1}"><em>No algorithm results available in the selection.</em></td>`;
        tbody.appendChild(empty);
    }

    table.appendChild(tbody);
    return table;
}

function renderBenchmarkDetailTable(selected) {
    const container = document.createElement("div");
    container.className = "benchmark-detail-grid";

    selected.forEach((benchmark) => {
        const card = document.createElement("div");
        card.className = "comparison-card benchmark-detail-card";

        const header = document.createElement("div");
        header.className = "benchmark-detail-header";
        header.innerHTML = `
            <div>
                <div class="benchmark-note">${benchmarkLabel(benchmark)}</div>
                <div class="about-text">${formatMapName(benchmark.mapName)} -> ${Math.round((benchmark.pacmanRandomness ?? 0) * 100)}% randomness</div>
                <div class="about-text">${formatTimestamp(benchmark.timestamp)}</div>
            </div>
        `;

        const resultsTable = document.createElement("table");
        resultsTable.className = "comparison-table compact";

        const thead = document.createElement("thead");
        thead.innerHTML = `
            <tr>
                <th>Algorithm</th>
                <th>Avg Time</th>
                <th>Avg Nodes</th>
                <th>Avg Ticks</th>
                <th>Catch</th>
            </tr>
        `;
        resultsTable.appendChild(thead);

        const tbody = document.createElement("tbody");
        if (benchmark.results?.length) {
            benchmark.results.forEach((result) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${result.algorithm}</td>
                    <td>${result.avgTimeMs.toFixed(3)} ms</td>
                    <td>${result.avgNodesVisited.toFixed(1)}</td>
                    <td>${result.avgTicksToCatch.toFixed(1)}</td>
                    <td>${(result.catchRate * 100).toFixed(0)}%</td>
                `;
                tbody.appendChild(row);
            });
        } else {
            const empty = document.createElement("tr");
            empty.innerHTML = '<td colspan="5"><em>No results recorded for this benchmark.</em></td>';
            tbody.appendChild(empty);
        }

        resultsTable.appendChild(tbody);

        card.appendChild(header);
        card.appendChild(resultsTable);

        container.appendChild(card);
    });

    return container;
}

function benchmarkLabel(benchmark) {
    if (benchmark.note) return benchmark.note;
    const date = new Date(benchmark.timestamp);
    return `Run on ${date.toLocaleDateString()}`;
}

async function loadBenchmarks() {
    statusTag.textContent = "Loading...";
    tableBody.innerHTML = `<tr><td colspan="6">Loading benchmarks...</td></tr>`;

    try {
        const mapName = mapFilter.value === "all" ? undefined : mapFilter.value;
        const limit = Number(limitInput.value) || 100;
        const data = await fetchBenchmarks({ mapName, limit });
        benchmarks = Array.isArray(data) ? data : [];
        statusTag.textContent = `${benchmarks.length} loaded`;

        const extraMaps = benchmarks.map((b) => b.mapName).filter(Boolean);
        renderMapOptions(extraMaps);
        if (mapName) {
            mapFilter.value = mapName;
        }

        renderTable();
        renderSelection();
    } catch (error) {
        console.error(error);
        statusTag.textContent = "Offline";
        tableBody.innerHTML = `<tr><td colspan="6">Failed to load benchmarks: ${error.message}</td></tr>`;
    }
}

function bindEvents() {
    refreshButton.addEventListener("click", () => loadBenchmarks());
    mapFilter.addEventListener("change", () => loadBenchmarks());
}

function init() {
    renderMapOptions();
    bindEvents();
    loadBenchmarks();
}

init();
