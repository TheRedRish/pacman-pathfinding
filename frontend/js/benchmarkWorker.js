import { runBenchmark } from "./benchmark.js";

self.onmessage = async (event) => {
    const { mapName, options } = event.data;

    try {
        const results = await runBenchmark(
            mapName,
            options,
            (progress) => {
                self.postMessage({ type: "progress", progress });
            }
        );

        self.postMessage({ type: "result", results });
    } catch (error) {
        self.postMessage({ type: "error", message: error.message });
    }
};
