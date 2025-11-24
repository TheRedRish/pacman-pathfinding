const apiBaseFromLocation = () => {
    const locationSource =
        typeof window !== "undefined" && window.location
            ? window.location
            : typeof self !== "undefined" && self.location
                ? self.location
                : null;

    if (!locationSource) {
        throw new Error("Unable to determine API base: missing location context");
    }

    const { protocol, hostname, port } = locationSource;
    const base = `${protocol}//${hostname}`;
    return port ? `${base}:${port}` : base;
};

export const API_URL = apiBaseFromLocation();

export async function fetchBackendHealth() {
    const response = await fetch(`${API_URL}/api/health`);
    if (!response.ok) {
        throw new Error(`Health check failed with status ${response.status}`);
    }
    return response.json();
}

export async function fetchBenchmarkStats() {
    const response = await fetch(`${API_URL}/api/benchmarks/stats`);
    if (!response.ok) {
        throw new Error("Failed to load benchmark statistics");
    }
    return response.json();
}

export async function fetchBenchmarks({ mapName, limit } = {}) {
    const params = new URLSearchParams();

    if (mapName) params.set("mapName", mapName);
    if (limit) params.set("limit", limit);

    const query = params.toString();
    const url = query ? `${API_URL}/api/benchmarks?${query}` : `${API_URL}/api/benchmarks`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to load benchmarks");
    }

    return response.json();
}

export async function fetchSavedMaps() {
    const response = await fetch(`${API_URL}/api/maps`);
    if (!response.ok) {
        throw new Error("Failed to load saved maps");
    }
    return response.json();
}

export async function saveCustomMap(mapDefinition) {
    const response = await fetch(`${API_URL}/api/maps`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(mapDefinition),
    });

    if (!response.ok) {
        throw new Error("Failed to save map");
    }

    return response.json();
}