interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export function pipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

function copyStyles(target: Document): void {
  for (const node of document.head.querySelectorAll('style, link[rel="stylesheet"]')) {
    const clone = node.cloneNode(true) as HTMLElement;
    if (clone instanceof HTMLLinkElement) {
      clone.href = (node as HTMLLinkElement).href;
    }
    target.head.append(clone);
  }
}

// Moves the stage into an always-on-top Document Picture-in-Picture window.
export class FloatingStage {
  private pipWindow: Window | null = null;
  private placeholder: Comment | null = null;

  constructor(
    private readonly stage: HTMLElement,
    private readonly video: HTMLVideoElement,
    private readonly onClosed: () => void,
  ) {}

  get isOpen(): boolean {
    return this.pipWindow !== null;
  }

  // Must be called synchronously from a user gesture.
  async open(): Promise<boolean> {
    if (this.pipWindow) {
      return true;
    }
    const api = window.documentPictureInPicture;
    if (!api) {
      return false;
    }
    let pip: Window;
    try {
      pip = await api.requestWindow({ width: 360, height: 270 });
    } catch {
      return false;
    }
    this.pipWindow = pip;
    copyStyles(pip.document);
    pip.document.title = "Tartaruguinha";
    pip.document.body.classList.add("pip-body");
    this.placeholder = document.createComment("stage");
    this.stage.replaceWith(this.placeholder);
    pip.document.body.append(this.stage);
    void this.video.play().catch(() => undefined);
    pip.addEventListener("pagehide", () => this.restore(), { once: true });
    return true;
  }

  close(): void {
    this.pipWindow?.close();
    this.restore();
  }

  private restore(): void {
    if (!this.pipWindow) {
      return;
    }
    this.pipWindow = null;
    this.placeholder?.replaceWith(this.stage);
    this.placeholder = null;
    void this.video.play().catch(() => undefined);
    this.onClosed();
  }
}
