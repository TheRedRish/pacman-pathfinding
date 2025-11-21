const apiBaseFromLocation = () => {
    const { protocol, hostname, port } = window.location;
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

export async function fetchSavedMaps() {
    const response = await fetch(`${API_URL}/api/maps`);
    if (!response.ok) {
        throw new Error("Failed to load saved maps");
    }
    return response.json();
}