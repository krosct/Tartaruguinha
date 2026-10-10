import { CameraError, startCamera, stopCamera } from "./camera";
import { clearOverlay, drawSkeleton, resizeOverlay } from "./overlay";
import { loadHistory, newSessionId, saveRecord, SessionRecord } from "./history";
import { renderHistory } from "./historyPanel";
import { FloatingStage, pipSupported } from "./pip";
import { PoseDetector, PoseFrame } from "./pose";
import {
  canAlert,
  classifyPosture,
  computeMetrics,
  createStabilizer,
  isAlarming,
  requiredMissing,
  stabilize,
  StabilizerState,
} from "./posture";
import { MonitorSession } from "./session";
import {
  DETECTOR_KEYS,
  envDefaults,
  loadSettings,
  saveSettings,
  SettingKey,
  Settings,
} from "./settings";
import { mountSettingsPanel } from "./settingsPanel";
import { Ticker } from "./ticker";
import { PostureResult } from "./types";
import * as ui from "./ui";

const LANDMARK_NAMES: Record<string, string> = {
  nose: "nariz",
  left_shoulder: "ombro esquerdo",
  right_shoulder: "ombro direito",
};

const defaults = envDefaults();
let settings: Settings = loadSettings(defaults);

const el = ui.queryElements();

let stream: MediaStream | null = null;
let session: MonitorSession | null = null;
let poseDetector: PoseDetector | null = null;
let detectorGeneration = 0;
const ticker = new Ticker(detectOnce);
const floating = new FloatingStage([el.stage, el.pipFooter], el.video, () => {
  updatePipButton();
  if (session) {
    ui.setHint(el, "Janela flutuante fechada. A análise continua com a aba oculta.");
  }
});
let hiddenPaused = false;
let lastVerdictAt = 0;
let lastVideoTime = -1;
let current: SessionRecord | null = null;
let activeSince: number | null = null;
let lastTallyAt: number | null = null;
let lastAlertAt: number | null = null;
let lastNotificationAt: number | null = null;
let timerId: number | null = null;
let previewing = false;
let stabilizer: StabilizerState = createStabilizer(PostureResult.Unknown);

init();

function init(): void {
  el.consentCheck.addEventListener("change", () => {
    el.consentAccept.disabled = !el.consentCheck.checked;
  });

  el.consentAccept.addEventListener("click", () => {
    ui.showConsent(el, false);
    ui.setHint(el, "Clique em Iniciar para liberar a câmera.");
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  });

  el.toggle.addEventListener("click", () => {
    ui.unlockAudio();
    if (session) {
      pauseMonitoring();
    } else {
      void startMonitoring();
    }
  });

  el.restart.addEventListener("click", () => {
    ui.unlockAudio();
    restartSession();
  });

  el.pipOpen.addEventListener("click", openFloating);

  // The preview is mirrored with CSS, which would also mirror native video
  // controls; block the context menu that turns them on.
  el.stage.addEventListener("contextmenu", (event) => event.preventDefault());
  el.video.disablePictureInPicture = true;

  el.historyOpen.addEventListener("click", () => {
    persistSession();
    renderHistory(el.historyList, loadHistory(), current?.id ?? null);
    el.historyDialog.showModal();
  });

  el.historyClose.addEventListener("click", () => el.historyDialog.close());
  el.historyDialog.addEventListener("click", (event) => {
    if (event.target === el.historyDialog) {
      el.historyDialog.close();
    }
  });

  window.addEventListener("pagehide", persistSession);

  el.testSound.addEventListener("click", () => {
    ui.unlockAudio();
    ui.playAlertTone(settings.alertVolume);
  });

  applyDisplay();
  mountSettingsPanel({
    form: el.settingsForm,
    reset: el.settingsReset,
    current: settings,
    defaults,
    onChange: applySettings,
  });
}

function applyDisplay(): void {
  el.guide.classList.toggle("hidden", !settings.showGuide);
  if (!settings.showSkeleton) {
    clearOverlay(el.overlay);
  }
}

function applySettings(next: Settings, changed: SettingKey[]): void {
  settings = next;
  saveSettings(settings, defaults);
  applyDisplay();
  if (session && changed.some((key) => DETECTOR_KEYS.has(key))) {
    stopLiveDetection();
    ui.setHudIdle(el, "Recarregando o detector…");
    void startLiveDetection();
  } else if (poseDetector && changed.includes("detectIntervalMs")) {
    ticker.start(settings.detectIntervalMs);
  }
  if (changed.includes("backgroundMode")) {
    if (settings.backgroundMode === "pip" && session) {
      openFloating();
    } else if (settings.backgroundMode !== "pip") {
      floating.close();
    }
    updatePipButton();
  }
}

function updatePipButton(): void {
  const available =
    settings.backgroundMode === "pip" && pipSupported() && session !== null && !floating.isOpen;
  el.pipOpen.classList.toggle("hidden", !available);
}

function runsHidden(): boolean {
  return settings.backgroundMode !== "off";
}

// Document Picture-in-Picture needs recent user activation; it fails if the
// camera prompt took too long, and the pip button lets the user retry.
function openFloating(): void {
  if (settings.backgroundMode !== "pip") {
    return;
  }
  if (!pipSupported()) {
    ui.setHint(
      el,
      "Este navegador não tem janela flutuante. A análise continua com a aba oculta.",
    );
    return;
  }
  void floating.open().then((opened) => {
    updatePipButton();
    if (!opened && session) {
      ui.setHint(el, "Clique no botão de janela flutuante para abri-la.");
    }
  });
}

async function startMonitoring(): Promise<void> {
  ui.setHint(el, "");
  try {
    if (!previewing) {
      stream = await startCamera(el.video);
      previewing = true;
    }
  } catch (error) {
    handleCameraFailure(error);
    return;
  }

  if (!current) {
    beginSession();
  }
  stabilizer = createStabilizer(PostureResult.Unknown);
  lastTallyAt = null;
  ui.setToggle(el, "running", true);
  ui.setMonitoringState(el, "on");
  ui.setGuide(el, PostureResult.Unknown);
  ui.setHudIdle(el, "Verificando…");
  ui.setReason(el, "");
  ui.setStatus(el, PostureResult.Unknown, "Carregando o detector de postura...");

  session = new MonitorSession({
    onPause: () => {
      persistSession();
      if (runsHidden()) {
        ui.setBackgroundTitle(true);
        return;
      }
      hiddenPaused = true;
      closeActiveSpan();
      ui.setMonitoringState(el, "paused");
      ui.setHudIdle(el, "Pausado (aba oculta)");
    },
    onResume: () => {
      ui.setBackgroundTitle(false);
      if (!hiddenPaused) {
        return;
      }
      hiddenPaused = false;
      activeSince = Date.now();
      ui.setMonitoringState(el, "on");
      ui.setHudIdle(el, "Verificando…");
    },
  });
  updatePipButton();
  openFloating();
  await session.start();
  hiddenPaused = document.hidden && !runsHidden();
  activeSince = hiddenPaused ? null : Date.now();
  ui.setBackgroundTitle(document.hidden && !hiddenPaused);
  startTimer();
  void startLiveDetection();
}

function beginSession(): void {
  current = {
    id: newSessionId(),
    startedAt: Date.now(),
    activeMs: 0,
    alerts: 0,
    goodMs: 0,
    hunchedMs: 0,
  };
  activeSince = session && !hiddenPaused ? Date.now() : null;
  lastTallyAt = null;
  lastAlertAt = null;
  lastNotificationAt = null;
  stabilizer = createStabilizer(PostureResult.Unknown);
  ui.setAlertCount(el, 0);
  ui.setSessionTime(el, 0);
}

function restartSession(): void {
  closeActiveSpan();
  persistSession();
  current = null;
  if (session) {
    beginSession();
    ui.setHudIdle(el, "Verificando…");
    ui.setStatus(el, PostureResult.Unknown, "Nova sessão iniciada.");
  } else {
    void startMonitoring();
  }
}

function elapsedMs(): number {
  if (!current) {
    return 0;
  }
  return current.activeMs + (activeSince !== null ? Date.now() - activeSince : 0);
}

function closeActiveSpan(): void {
  if (current && activeSince !== null) {
    current.activeMs += Date.now() - activeSince;
  }
  activeSince = null;
  lastTallyAt = null;
}

function persistSession(): void {
  if (!current) {
    return;
  }
  const activeMs = elapsedMs();
  if (activeMs < 1000 && current.alerts === 0) {
    return;
  }
  saveRecord({ ...current, activeMs });
}

function tally(displayed: PostureResult, now: number): void {
  if (current && lastTallyAt !== null) {
    const delta = now - lastTallyAt;
    if (displayed === PostureResult.Good) {
      current.goodMs += delta;
    } else if (displayed === PostureResult.Hunched) {
      current.hunchedMs += delta;
    }
  }
  lastTallyAt = now;
}

function pauseMonitoring(): void {
  closeActiveSpan();
  persistSession();
  session?.stop();
  session = null;
  hiddenPaused = false;
  floating.close();
  updatePipButton();
  ui.setBackgroundTitle(false);
  stopTimer();
  stopLiveDetection();
  ui.setReason(el, "");
  ui.setHudIdle(el, "Monitoramento pausado");
  ui.setGuide(el, PostureResult.Unknown);
  stopCamera(el.video, stream);
  stream = null;
  previewing = false;
  ui.setToggle(el, current ? "paused" : "idle", current !== null);
  ui.setMonitoringState(el, current ? "paused" : "off");
  ui.setStatus(el, PostureResult.Unknown, "Monitoramento pausado.");
  ui.setHint(el, "Retomar continua esta sessão. O botão de reiniciar começa uma nova.");
}

async function startLiveDetection(): Promise<void> {
  const generation = ++detectorGeneration;
  try {
    const detector = await PoseDetector.create({
      model: settings.poseModel,
      delegate: settings.poseDelegate,
      minPoseDetectionConfidence: settings.minPoseDetectionConfidence,
      minPosePresenceConfidence: settings.minPosePresenceConfidence,
      minTrackingConfidence: settings.minTrackingConfidence,
    });
    if (!session || generation !== detectorGeneration) {
      detector.close();
      return;
    }
    poseDetector = detector;
    ticker.start(settings.detectIntervalMs);
  } catch {
    if (generation !== detectorGeneration) {
      return;
    }
    pauseMonitoring();
    ui.setStatus(
      el,
      PostureResult.Unknown,
      `Não foi possível carregar o detector de postura (modelo ${settings.poseModel}).`,
    );
    ui.setHint(
      el,
      "Confira se o modelo foi baixado (npm run fetch:pose) ou troque o modelo em Configurações.",
    );
  }
}

function stopLiveDetection(): void {
  detectorGeneration += 1;
  ticker.stop();
  poseDetector?.close();
  poseDetector = null;
  lastTallyAt = null;
  clearOverlay(el.overlay);
}

function detectOnce(): void {
  if (!poseDetector || (document.hidden && !runsHidden())) {
    return;
  }
  const video = el.video;
  if (!video.videoWidth || video.currentTime === lastVideoTime) {
    return;
  }
  lastVideoTime = video.currentTime;

  const now = performance.now();
  resizeOverlay(el.overlay, video);
  let frame: PoseFrame | null;
  try {
    frame = poseDetector.detect(video, now);
  } catch {
    frame = null;
  }
  handleLiveFrame(frame, now);
}

function handleLiveFrame(frame: PoseFrame | null, now: number): void {
  const confidence = frame?.confidence ?? 0;
  const instant = frame
    ? classifyPosture(frame.landmarks, confidence, settings)
    : PostureResult.NotVisible;

  if (settings.showSkeleton) {
    drawSkeleton(el.overlay, frame?.points ?? null, instant, settings.minLandmarkVisibility);
  }
  ui.setReason(el, liveReason(frame, instant));

  if (now - lastVerdictAt < settings.verdictIntervalMs) {
    return;
  }
  lastVerdictAt = now;

  stabilizer = stabilize(stabilizer, instant, settings.stateSmoothing);
  const displayed = stabilizer.displayed;
  tally(displayed, now);
  ui.setGuide(el, instant);
  ui.setHud(el, displayed, confidence);
  ui.setStatus(el, displayed, ui.STATUS_DETAIL[displayed]);
  maybeAlert(displayed);
}

function liveReason(frame: PoseFrame | null, instant: PostureResult): string {
  if (!frame) {
    return "Nenhum ponto detectado. Mostre o tronco inteiro no quadro.";
  }
  const missing = requiredMissing(frame.landmarks, settings.minLandmarkVisibility);
  if (missing.length > 0) {
    const names = missing.map((key) => LANDMARK_NAMES[key] ?? key).join(", ");
    return `Não achei: ${names}. Afaste-se um pouco e mostre os ombros.`;
  }
  const metrics = computeMetrics(frame.landmarks, settings);
  if (!metrics) {
    return "Ajuste o enquadramento para o modelo ver seus ombros.";
  }
  const verdict = instant === PostureResult.Good ? "reto" : "curvado";
  const tip =
    instant === PostureResult.Hunched
      ? " Se você está reto, afaste-se da câmera ou levante-a até a altura dos olhos."
      : "";
  return `Pescoço/ombro = ${metrics.neckRatio.toFixed(2)} (mínimo ${metrics.threshold.toFixed(2)}) → ${verdict}.${tip}`;
}

function maybeAlert(displayed: PostureResult): void {
  if (!isAlarming(displayed)) {
    return;
  }
  const now = Date.now();
  if (canAlert(lastAlertAt, now, settings.alertCooldownMs)) {
    lastAlertAt = now;
    if (current) {
      current.alerts += 1;
      ui.setAlertCount(el, current.alerts);
      persistSession();
    }
    if (settings.alertSound === "on") {
      ui.playAlertTone(settings.alertVolume);
    }
    ui.flash(el.stage);
  }
  if (canAlert(lastNotificationAt, now, settings.notificationCooldownMs)) {
    lastNotificationAt = now;
    ui.notify("Tartaruguinha", ui.STATUS_DETAIL[PostureResult.Hunched]);
  }
}

function handleCameraFailure(error: unknown): void {
  const reason = error instanceof CameraError ? error.reason : "failed";
  floating.close();
  ui.setToggle(el, current ? "paused" : "idle", current !== null);
  if (reason === "denied" || reason === "unsupported") {
    previewing = false;
    ui.setMonitoringState(el, "off");
    ui.setStatus(el, PostureResult.NotVisible, "A câmera não está disponível.");
    ui.setHint(el, "Libere o acesso à câmera nas configurações do navegador.");
    return;
  }
  ui.setStatus(el, PostureResult.Unknown, "Não foi possível iniciar a câmera.");
}

function startTimer(): void {
  stopTimer();
  const update = () => {
    ui.setSessionTime(el, elapsedMs());
    persistSession();
  };
  update();
  timerId = window.setInterval(update, 1000);
}

function stopTimer(): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}
