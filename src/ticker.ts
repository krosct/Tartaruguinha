// Timers inside a dedicated worker keep their pace while the tab is hidden;
// main-thread timers and requestAnimationFrame get throttled or stop.
const WORKER_SOURCE = `
let id = null;
onmessage = (event) => {
  clearInterval(id);
  id = null;
  if (event.data > 0) {
    id = setInterval(() => postMessage(0), event.data);
  }
};
`;

export class Ticker {
  private worker: Worker | null = null;
  private fallbackId: number | null = null;

  constructor(private readonly onTick: () => void) {}

  start(intervalMs: number): void {
    this.stop();
    const worker = this.ensureWorker();
    if (worker) {
      worker.postMessage(intervalMs);
    } else {
      this.fallbackId = window.setInterval(this.onTick, intervalMs);
    }
  }

  stop(): void {
    this.worker?.postMessage(0);
    if (this.fallbackId !== null) {
      window.clearInterval(this.fallbackId);
      this.fallbackId = null;
    }
  }

  private ensureWorker(): Worker | null {
    if (this.worker) {
      return this.worker;
    }
    try {
      const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
      this.worker = new Worker(url);
      URL.revokeObjectURL(url);
      this.worker.onmessage = () => this.onTick();
      return this.worker;
    } catch {
      return null;
    }
  }
}
