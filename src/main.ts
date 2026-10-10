import { CameraError, startCamera, stopCamera } from "./camera";
import { clearOverlay, drawSkeleton, resizeOverlay } from "./overlay";
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
let rafId: number | null = null;
let lastDetectAt = 0;
let lastVerdictAt = 0;
let lastVideoTime = -1;
let sessionStartedAt = 0;
let alertCount = 0;
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
      stopMonitoring();
    } else {
      void startMonitoring();
    }
  });

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
  }
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

  sessionStartedAt = Date.now();
  alertCount = 0;
  lastAlertAt = null;
  lastNotificationAt = null;
  stabilizer = createStabilizer(PostureResult.Unknown);
  ui.setAlertCount(el, alertCount);
  ui.setToggle(el, true);
  ui.setMonitoringState(el, "on");
  ui.setGuide(el, PostureResult.Unknown);
  ui.setHudIdle(el, "Verificando…");
  ui.setReason(el, "");
  ui.setStatus(el, PostureResult.Unknown, "Carregando o detector de postura...");

  session = new MonitorSession({
    onPause: () => {
      ui.setMonitoringState(el, "paused");
      ui.setHudIdle(el, "Pausado (aba oculta)");
    },
    onResume: () => {
      ui.setMonitoringState(el, "on");
      ui.setHudIdle(el, "Verificando…");
    },
  });
  await session.start();
  startTimer();
  void startLiveDetection();
}

function stopMonitoring(): void {
  session?.stop();
  session = null;
  stopTimer();
  stopLiveDetection();
  ui.setReason(el, "");
  ui.setHudIdle(el, "Monitoramento desligado");
  ui.setGuide(el, PostureResult.Unknown);
  stopCamera(el.video, stream);
  stream = null;
  previewing = false;
  ui.setToggle(el, false);
  ui.setMonitoringState(el, "off");
  ui.setStatus(el, PostureResult.Unknown, "Monitoramento parado.");
  ui.setHint(el, "Clique em Iniciar para retomar.");
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
    startLiveLoop();
  } catch {
    if (generation !== detectorGeneration) {
      return;
    }
    stopMonitoring();
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
  stopLiveLoop();
  poseDetector?.close();
  poseDetector = null;
  clearOverlay(el.overlay);
}

function startLiveLoop(): void {
  stopLiveLoop();
  const loop = () => {
    rafId = requestAnimationFrame(loop);
    if (!poseDetector || document.hidden) {
      return;
    }
    const now = performance.now();
    if (now - lastDetectAt < settings.detectIntervalMs) {
      return;
    }
    const video = el.video;
    if (!video.videoWidth || video.currentTime === lastVideoTime) {
      return;
    }
    lastDetectAt = now;
    lastVideoTime = video.currentTime;

    resizeOverlay(el.overlay, video);
    let frame: PoseFrame | null;
    try {
      frame = poseDetector.detect(video, now);
    } catch {
      frame = null;
    }
    handleLiveFrame(frame, now);
  };
  rafId = requestAnimationFrame(loop);
}

function stopLiveLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
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
    alertCount += 1;
    ui.setAlertCount(el, alertCount);
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
  const update = () => ui.setSessionTime(el, Date.now() - sessionStartedAt);
  update();
  timerId = window.setInterval(update, 1000);
}

function stopTimer(): void {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}
