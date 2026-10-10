import { PostureResult } from "./types";

export const STATUS_TEXT: Record<PostureResult, string> = {
  [PostureResult.Good]: "Boa postura",
  [PostureResult.Hunched]: "Atenção: você está curvado",
  [PostureResult.NotVisible]: "Ajuste o enquadramento",
  [PostureResult.Unknown]: "Sem certeza",
};

export const STATUS_DETAIL: Record<PostureResult, string> = {
  [PostureResult.Good]: "Siga assim: ombros para trás e cabeça alinhada.",
  [PostureResult.Hunched]: "Você está curvado. Tente sentar mais reto.",
  [PostureResult.NotVisible]: "Não vejo seu tronco. Centralize-o no quadro.",
  [PostureResult.Unknown]: "Sem certeza. Melhore a luz ou ajuste o enquadramento.",
};

export const HUD_TEXT: Record<PostureResult, string> = {
  [PostureResult.Good]: "Tronco detectado",
  [PostureResult.Hunched]: "Tronco detectado (curvado)",
  [PostureResult.NotVisible]: "Tronco não detectado",
  [PostureResult.Unknown]: "Detecção incerta",
};

export type MonitoringState = "on" | "off" | "paused";

export type ToggleState = "idle" | "running" | "paused";

const TOGGLE_TEXT: Record<ToggleState, string> = {
  idle: "Iniciar",
  running: "Pausar",
  paused: "Retomar",
};

export interface UiElements {
  consent: HTMLElement;
  consentCheck: HTMLInputElement;
  consentAccept: HTMLButtonElement;
  monitor: HTMLElement;
  video: HTMLVideoElement;
  status: HTMLElement;
  statusDetail: HTMLElement;
  toggle: HTMLButtonElement;
  restart: HTMLButtonElement;
  historyOpen: HTMLButtonElement;
  pipOpen: HTMLButtonElement;
  pipFooter: HTMLElement;
  pipTime: HTMLElement;
  pipAlerts: HTMLElement;
  historyDialog: HTMLDialogElement;
  historyClose: HTMLButtonElement;
  historyList: HTMLElement;
  historyClear: HTMLButtonElement;
  confirmDialog: HTMLDialogElement;
  confirmMessage: HTMLElement;
  confirmOk: HTMLButtonElement;
  sessionTime: HTMLElement;
  alertCount: HTMLElement;
  hint: HTMLElement;
  stage: HTMLElement;
  guide: HTMLElement;
  hud: HTMLElement;
  hudText: HTMLElement;
  reason: HTMLElement;
  overlay: HTMLCanvasElement;
  settingsForm: HTMLFormElement;
  settingsReset: HTMLButtonElement;
  testSound: HTMLButtonElement;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Elemento #${id} não encontrado.`);
  }
  return element as T;
}

export function queryElements(): UiElements {
  return {
    consent: requireElement("consent"),
    consentCheck: requireElement<HTMLInputElement>("consent-check"),
    consentAccept: requireElement<HTMLButtonElement>("consent-accept"),
    monitor: requireElement("monitor"),
    video: requireElement<HTMLVideoElement>("preview"),
    status: requireElement("status"),
    statusDetail: requireElement("status-detail"),
    toggle: requireElement<HTMLButtonElement>("toggle"),
    restart: requireElement<HTMLButtonElement>("restart"),
    historyOpen: requireElement<HTMLButtonElement>("history-open"),
    pipOpen: requireElement<HTMLButtonElement>("pip-open"),
    pipFooter: requireElement("pip-footer"),
    pipTime: requireElement("pip-time"),
    pipAlerts: requireElement("pip-alerts"),
    historyDialog: requireElement<HTMLDialogElement>("history-dialog"),
    historyClose: requireElement<HTMLButtonElement>("history-close"),
    historyList: requireElement("history-list"),
    historyClear: requireElement<HTMLButtonElement>("history-clear"),
    confirmDialog: requireElement<HTMLDialogElement>("confirm-dialog"),
    confirmMessage: requireElement("confirm-message"),
    confirmOk: requireElement<HTMLButtonElement>("confirm-ok"),
    sessionTime: requireElement("session-time"),
    alertCount: requireElement("alert-count"),
    hint: requireElement("hint"),
    stage: requireElement("stage"),
    guide: requireElement("guide"),
    hud: requireElement("hud"),
    hudText: requireElement("hud-text"),
    reason: requireElement("reason"),
    overlay: requireElement<HTMLCanvasElement>("pose-overlay"),
    settingsForm: requireElement<HTMLFormElement>("settings-form"),
    settingsReset: requireElement<HTMLButtonElement>("settings-reset"),
    testSound: requireElement<HTMLButtonElement>("test-sound"),
  };
}

export function showConsent(el: UiElements, visible: boolean): void {
  el.consent.classList.toggle("hidden", !visible);
  el.monitor.classList.toggle("hidden", visible);
}

export function setStatus(el: UiElements, result: PostureResult, detail: string): void {
  el.status.textContent = STATUS_TEXT[result];
  el.status.dataset.result = result;
  el.statusDetail.textContent = detail;
}

export function setGuide(el: UiElements, result: PostureResult): void {
  el.guide.dataset.result = result;
}

export function setHud(el: UiElements, result: PostureResult, confidence: number): void {
  el.hud.dataset.result = result;
  el.hudText.textContent = `${HUD_TEXT[result]} · ${Math.round(confidence * 100)}%`;
}

export function setHudIdle(el: UiElements, text: string): void {
  el.hud.dataset.result = PostureResult.Unknown;
  el.hudText.textContent = text;
}

export function setReason(el: UiElements, text: string): void {
  el.reason.textContent = text;
  el.reason.dataset.visible = String(Boolean(text));
}

export function setMonitoringState(el: UiElements, state: MonitoringState): void {
  el.hud.dataset.monitoring = state;
}

export function setToggle(el: UiElements, state: ToggleState, hasSession: boolean): void {
  el.toggle.textContent = TOGGLE_TEXT[state];
  el.toggle.dataset.state = state;
  el.restart.disabled = !hasSession;
}

const APP_TITLE = "Tartaruguinha";
const BACKGROUND_TITLE = "🟢 Tartaruguinha está de olho!";

export function setBackgroundTitle(active: boolean): void {
  document.title = active ? BACKGROUND_TITLE : APP_TITLE;
}

export function confirmAction(
  el: UiElements,
  message: string,
  confirmLabel: string,
): Promise<boolean> {
  const dialog = el.confirmDialog;
  el.confirmMessage.textContent = message;
  el.confirmOk.textContent = confirmLabel;
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), {
      once: true,
    });
  });
}

export function setHint(el: UiElements, text: string): void {
  el.hint.textContent = text;
}

export function setSessionTime(el: UiElements, elapsedMs: number): void {
  el.sessionTime.textContent = formatDuration(elapsedMs);
  el.pipTime.textContent = el.sessionTime.textContent;
}

export function setAlertCount(el: UiElements, count: number): void {
  el.alertCount.textContent = String(count);
  el.pipAlerts.textContent = `${count} ${count === 1 ? "alerta" : "alertas"}`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${String(hours).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioContext) {
    return audioContext;
  }
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  audioContext = Ctor ? new Ctor() : null;
  return audioContext;
}

// Browsers keep audio suspended until a user gesture; call this from a click.
export function unlockAudio(): void {
  try {
    void getAudioContext()?.resume();
  } catch {
    // Audio is best-effort.
  }
}

const CHIME_NOTES = [
  { frequency: 880, start: 0 },
  { frequency: 660, start: 0.18 },
];

export function playAlertTone(volume: number): void {
  try {
    const context = getAudioContext();
    if (!context || volume <= 0) {
      return;
    }
    void context.resume();
    const peak = Math.min(1, volume) * 0.6;
    for (const note of CHIME_NOTES) {
      const at = context.currentTime + note.start;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = note.frequency;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.55);
    }
  } catch {
    // Audio is best-effort; never break monitoring over a missing tone.
  }
}

export function notify(title: string, body: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") {
    return;
  }
  new Notification(title, { body });
}

export function flash(el: HTMLElement): void {
  el.classList.remove("flash");
  void el.offsetWidth;
  el.classList.add("flash");
}
