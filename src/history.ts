export interface SessionRecord {
  id: string;
  startedAt: number;
  activeMs: number;
  alerts: number;
  goodMs: number;
  hunchedMs: number;
}

export type Trend =
  | { kind: "first" }
  | { kind: "change"; percent: number }
  | { kind: "new_alerts" };

const STORAGE_KEY = "tartaruguinha.history.v1";

function isRecord(value: unknown): value is SessionRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    ["startedAt", "activeMs", "alerts", "goodMs", "hunchedMs"].every(
      (key) => typeof item[key] === "number" && Number.isFinite(item[key]),
    )
  );
}

export function parseHistory(raw: string | null): SessionRecord[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

export function upsertRecord(history: SessionRecord[], record: SessionRecord): SessionRecord[] {
  const rest = history.filter((item) => item.id !== record.id);
  return [...rest, { ...record }].sort((a, b) => a.startedAt - b.startedAt);
}

export function postureShare(record: SessionRecord): { good: number; hunched: number } | null {
  const classified = record.goodMs + record.hunchedMs;
  if (classified <= 0) {
    return null;
  }
  const good = Math.round((record.goodMs / classified) * 100);
  return { good, hunched: 100 - good };
}

export function alertTrend(previous: SessionRecord | undefined, current: SessionRecord): Trend {
  if (!previous) {
    return { kind: "first" };
  }
  if (previous.alerts === 0) {
    return current.alerts === 0 ? { kind: "change", percent: 0 } : { kind: "new_alerts" };
  }
  const percent = Math.round(((previous.alerts - current.alerts) / previous.alerts) * 100);
  return { kind: "change", percent };
}

export function loadHistory(): SessionRecord[] {
  try {
    return parseHistory(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveRecord(record: SessionRecord): void {
  try {
    const next = upsertRecord(loadHistory(), record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be blocked; the live session keeps working.
  }
}

export function newSessionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
