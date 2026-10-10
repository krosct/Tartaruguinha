export type PoseModel = "lite" | "full" | "heavy";
export type PoseDelegate = "GPU" | "CPU";
export type AlertSound = "on" | "off";
export type BackgroundMode = "off" | "worker" | "pip";

export interface Settings {
  showGuide: boolean;
  showSkeleton: boolean;
  hunchedNeckRatio: number;
  minLandmarkVisibility: number;
  confidenceThreshold: number;
  detectIntervalMs: number;
  verdictIntervalMs: number;
  stateSmoothing: number;
  alertCooldownMs: number;
  alertSound: AlertSound;
  alertVolume: number;
  notificationCooldownMs: number;
  backgroundMode: BackgroundMode;
  poseModel: PoseModel;
  poseDelegate: PoseDelegate;
  minPoseDetectionConfidence: number;
  minPosePresenceConfidence: number;
  minTrackingConfidence: number;
}

export type SettingKey = keyof Settings;

export type FieldGroup = "display" | "rule" | "timing" | "alert" | "background" | "detector";

interface BaseField {
  key: SettingKey;
  env: string;
  group: FieldGroup;
  label: string;
  help: string;
}

export interface NumberField extends BaseField {
  kind: "number";
  fallback: number;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
}

export interface SelectField extends BaseField {
  kind: "select";
  fallback: string;
  options: Array<{ value: string; label: string }>;
}

export interface BooleanField extends BaseField {
  kind: "boolean";
  fallback: boolean;
}

export type Field = NumberField | SelectField | BooleanField;

export type SettingValue = number | string | boolean;

export const GROUP_TITLES: Record<FieldGroup, string> = {
  display: "Exibição",
  rule: "Regra de postura",
  timing: "Tempo e estabilidade",
  alert: "Alerta",
  background: "Segundo plano",
  detector: "Detector (MediaPipe)",
};

export const FIELDS: Field[] = [
  {
    key: "showGuide",
    env: "VITE_SHOW_GUIDE",
    group: "display",
    kind: "boolean",
    label: "Mostrar posição de referência",
    help: "Exibe o quadrado colorido que indica onde posicionar o tronco.",
    fallback: true,
  },
  {
    key: "showSkeleton",
    env: "VITE_SHOW_SKELETON",
    group: "display",
    kind: "boolean",
    label: "Mostrar esqueleto detectado",
    help: "Desenha os pontos e linhas do corpo sobre a imagem da câmera.",
    fallback: true,
  },
  {
    key: "hunchedNeckRatio",
    env: "VITE_HUNCHED_NECK_RATIO",
    group: "rule",
    kind: "number",
    label: "Razão pescoço/ombro mínima",
    help: "Abaixo deste valor você é considerado curvado. Maior = mais rigoroso.",
    fallback: 0.6,
    min: 0,
    max: 2,
    step: 0.01,
  },
  {
    key: "minLandmarkVisibility",
    env: "VITE_MIN_LANDMARK_VISIBILITY",
    group: "rule",
    kind: "number",
    label: "Visibilidade mínima dos pontos",
    help: "Nariz ou ombro abaixo disso conta como “tronco não visível”.",
    fallback: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: "confidenceThreshold",
    env: "VITE_CONFIDENCE_THRESHOLD",
    group: "rule",
    kind: "number",
    label: "Confiança mínima",
    help: "Média da visibilidade de nariz e ombros. Abaixo disso o estado é “incerto”.",
    fallback: 0.6,
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: "detectIntervalMs",
    env: "VITE_DETECT_INTERVAL_MS",
    group: "timing",
    kind: "number",
    label: "Intervalo entre detecções (ms)",
    help: "Com que frequência o MediaPipe analisa o vídeo. Menor = mais fluido e mais CPU.",
    fallback: 100,
    min: 16,
    max: 5000,
    step: 10,
    integer: true,
  },
  {
    key: "verdictIntervalMs",
    env: "VITE_VERDICT_INTERVAL_MS",
    group: "timing",
    kind: "number",
    label: "Intervalo entre leituras (ms)",
    help: "Com que frequência uma leitura entra no estabilizador e pode gerar alerta.",
    fallback: 500,
    min: 50,
    max: 10000,
    step: 50,
    integer: true,
  },
  {
    key: "stateSmoothing",
    env: "VITE_STATE_SMOOTHING",
    group: "timing",
    kind: "number",
    label: "Leituras iguais para mudar o estado",
    help: "Quantas leituras seguidas iguais são necessárias antes de trocar o estado mostrado.",
    fallback: 2,
    min: 1,
    max: 50,
    step: 1,
    integer: true,
  },
  {
    key: "alertCooldownMs",
    env: "VITE_ALERT_COOLDOWN_MS",
    group: "alert",
    kind: "number",
    label: "Intervalo mínimo entre alertas sonoros (ms)",
    help: "Depois de tocar o som (e piscar a tela), espera este tempo antes de tocar de novo.",
    fallback: 60000,
    min: 0,
    max: 3600000,
    step: 1000,
    integer: true,
  },
  {
    key: "alertSound",
    env: "VITE_ALERT_SOUND",
    group: "alert",
    kind: "select",
    label: "Som do alerta",
    help: "Toca um aviso sonoro quando você fica curvado.",
    fallback: "on",
    options: [
      { value: "on", label: "Ligado" },
      { value: "off", label: "Desligado" },
    ],
  },
  {
    key: "alertVolume",
    env: "VITE_ALERT_VOLUME",
    group: "alert",
    kind: "number",
    label: "Volume do alerta",
    help: "De 0 (mudo) a 1 (máximo).",
    fallback: 0.6,
    min: 0,
    max: 1,
    step: 0.1,
  },
  {
    key: "notificationCooldownMs",
    env: "VITE_NOTIFICATION_COOLDOWN_MS",
    group: "alert",
    kind: "number",
    label: "Intervalo mínimo entre notificações (ms)",
    help: "Depois de enviar uma notificação do sistema, espera este tempo antes de enviar outra. Independente do som.",
    fallback: 60000,
    min: 0,
    max: 3600000,
    step: 1000,
    integer: true,
  },
  {
    key: "backgroundMode",
    env: "VITE_BACKGROUND_MODE",
    group: "background",
    kind: "select",
    label: "Quando a aba ficar oculta",
    help: "Continuar segue analisando com a aba oculta e avisa por som e notificação. A janela flutuante mantém a câmera visível por cima das outras janelas (Chrome/Edge no computador).",
    fallback: "worker",
    options: [
      { value: "off", label: "Pausar" },
      { value: "worker", label: "Continuar em segundo plano" },
      { value: "pip", label: "Janela flutuante" },
    ],
  },
  {
    key: "poseModel",
    env: "VITE_POSE_MODEL",
    group: "detector",
    kind: "select",
    label: "Modelo",
    help: "Modelos maiores são mais precisos e mais pesados. Rode “npm run fetch:pose” para baixá-los.",
    fallback: "lite",
    options: [
      { value: "lite", label: "Lite (leve)" },
      { value: "full", label: "Full (intermediário)" },
      { value: "heavy", label: "Heavy (mais preciso)" },
    ],
  },
  {
    key: "poseDelegate",
    env: "VITE_POSE_DELEGATE",
    group: "detector",
    kind: "select",
    label: "Processador",
    help: "GPU é mais rápida; se falhar, o app usa a CPU automaticamente.",
    fallback: "GPU",
    options: [
      { value: "GPU", label: "GPU (com CPU de reserva)" },
      { value: "CPU", label: "CPU" },
    ],
  },
  {
    key: "minPoseDetectionConfidence",
    env: "VITE_MIN_POSE_DETECTION_CONFIDENCE",
    group: "detector",
    kind: "number",
    label: "Confiança mínima de detecção",
    help: "Confiança para o MediaPipe considerar que há uma pessoa na imagem.",
    fallback: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: "minPosePresenceConfidence",
    env: "VITE_MIN_POSE_PRESENCE_CONFIDENCE",
    group: "detector",
    kind: "number",
    label: "Confiança mínima de presença",
    help: "Confiança para manter a pessoa como presente entre quadros.",
    fallback: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
  },
  {
    key: "minTrackingConfidence",
    env: "VITE_MIN_TRACKING_CONFIDENCE",
    group: "detector",
    kind: "number",
    label: "Confiança mínima de rastreamento",
    help: "Abaixo disso o MediaPipe refaz a detecção do zero em vez de rastrear.",
    fallback: 0.5,
    min: 0,
    max: 1,
    step: 0.05,
  },
];

export const DETECTOR_KEYS: ReadonlySet<SettingKey> = new Set(
  FIELDS.filter((field) => field.group === "detector").map((field) => field.key),
);

const STORAGE_KEY = "tartaruguinha.settings.v1";

const TRUE_VALUES = new Set(["true", "1", "on", "yes", "sim"]);
const FALSE_VALUES = new Set(["false", "0", "off", "no", "nao", "não"]);

export function sanitize(field: Field, raw: unknown): SettingValue | null {
  if (field.kind === "boolean") {
    if (typeof raw === "boolean") {
      return raw;
    }
    const value = String(raw ?? "").trim().toLowerCase();
    if (TRUE_VALUES.has(value)) {
      return true;
    }
    return FALSE_VALUES.has(value) ? false : null;
  }
  if (field.kind === "select") {
    const value = String(raw ?? "").trim();
    return field.options.some((option) => option.value === value) ? value : null;
  }
  if (raw === null || raw === undefined || String(raw).trim() === "") {
    return null;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const clamped = Math.min(field.max, Math.max(field.min, parsed));
  return field.integer ? Math.round(clamped) : clamped;
}

function build(source: (field: Field) => unknown, base?: Settings): Settings {
  const result: Record<string, SettingValue> = {};
  for (const field of FIELDS) {
    const value = sanitize(field, source(field));
    result[field.key] = value ?? base?.[field.key] ?? field.fallback;
  }
  return result as unknown as Settings;
}

export function envDefaults(env: Record<string, unknown> = import.meta.env): Settings {
  return build((field) => env[field.env]);
}

function readStored(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function loadSettings(defaults: Settings = envDefaults()): Settings {
  const stored = readStored();
  return build((field) => stored[field.key], defaults);
}

export function saveSettings(settings: Settings, defaults: Settings = envDefaults()): void {
  const overrides: Record<string, unknown> = {};
  for (const field of FIELDS) {
    if (settings[field.key] !== defaults[field.key]) {
      overrides[field.key] = settings[field.key];
    }
  }
  try {
    if (Object.keys(overrides).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    }
  } catch {
    // Storage may be blocked; settings still apply for this session.
  }
}
