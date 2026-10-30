import { runSimulation, type SimulationOptions } from "./simulate";

self.onmessage = (event: MessageEvent<SimulationOptions>) => {
  try {
    self.postMessage({ ok: true, result: runSimulation(event.data) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
