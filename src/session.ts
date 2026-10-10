export interface MonitorCallbacks {
  onPause: () => void;
  onResume: () => void;
}

export class MonitorSession {
  private wakeLock: WakeLockSentinel | null = null;
  private readonly visibilityHandler: () => void;

  constructor(private readonly callbacks: MonitorCallbacks) {
    this.visibilityHandler = () => {
      if (document.hidden) {
        void this.releaseWakeLock();
        this.callbacks.onPause();
      } else {
        void this.acquireWakeLock();
        this.callbacks.onResume();
      }
    };
  }

  async start(): Promise<void> {
    document.addEventListener("visibilitychange", this.visibilityHandler);
    await this.acquireWakeLock();
  }

  stop(): void {
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    void this.releaseWakeLock();
  }

  private async acquireWakeLock(): Promise<void> {
    if (!("wakeLock" in navigator) || this.wakeLock) {
      return;
    }
    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
    } catch {
      this.wakeLock = null;
    }
  }

  private async releaseWakeLock(): Promise<void> {
    if (!this.wakeLock) {
      return;
    }
    const lock = this.wakeLock;
    this.wakeLock = null;
    try {
      await lock.release();
    } catch {
      // Best-effort: the OS may already have released it.
    }
  }
}
