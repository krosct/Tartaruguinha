import { alertTrend, postureShare, SessionRecord, Trend } from "./history";
import { formatDuration } from "./ui";

function trendBadge(trend: Trend, previous: SessionRecord | undefined): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "trend";
  if (trend.kind === "first") {
    badge.dataset.trend = "neutral";
    badge.textContent = "Primeira sessão";
    return badge;
  }
  if (trend.kind === "new_alerts") {
    badge.dataset.trend = "worse";
    badge.textContent = "▼ Piorou (antes: 0 alertas)";
    return badge;
  }
  const from = previous ? ` (antes: ${previous.alerts})` : "";
  if (trend.percent > 0) {
    badge.dataset.trend = "better";
    badge.textContent = `▲ ${trend.percent}% de melhora${from}`;
  } else if (trend.percent < 0) {
    badge.dataset.trend = "worse";
    badge.textContent = `▼ ${Math.abs(trend.percent)}% de piora${from}`;
  } else {
    badge.dataset.trend = "neutral";
    badge.textContent = `= Sem mudança${from}`;
  }
  return badge;
}

function stat(label: string, value: string, tone?: string): HTMLElement {
  const item = document.createElement("div");
  item.className = "history-stat";
  if (tone) {
    item.dataset.tone = tone;
  }
  const name = document.createElement("span");
  name.textContent = label;
  const strong = document.createElement("b");
  strong.textContent = value;
  item.append(name, strong);
  return item;
}

export function formatSessionStart(record: SessionRecord): string {
  const started = new Date(record.startedAt);
  const date = started.toLocaleDateString("pt-BR");
  const time = started.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${date} às ${time}`;
}

function deleteButton(record: SessionRecord, onDelete: (record: SessionRecord) => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "history-delete";
  button.setAttribute("aria-label", `Apagar a sessão de ${formatSessionStart(record)}`);
  button.title = "Apagar esta sessão";
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>';
  button.addEventListener("click", () => onDelete(record));
  return button;
}

export function renderHistory(
  container: HTMLElement,
  history: SessionRecord[],
  currentId: string | null,
  onDelete: (record: SessionRecord) => void,
): void {
  container.replaceChildren();
  if (history.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Nenhuma sessão registrada ainda.";
    container.append(empty);
    return;
  }

  const list = document.createElement("ol");
  list.className = "history-list";
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const record = history[index];
    const previous = history[index - 1];

    const item = document.createElement("li");
    item.className = "history-item";

    const head = document.createElement("div");
    head.className = "history-head";
    const when = document.createElement("span");
    when.className = "history-when";
    when.textContent = formatSessionStart(record);
    if (record.id === currentId) {
      const tag = document.createElement("span");
      tag.className = "history-current";
      tag.textContent = "atual";
      when.append(" ", tag);
    }
    head.append(when, trendBadge(alertTrend(previous, record), previous));

    const share = postureShare(record);
    const stats = document.createElement("div");
    stats.className = "history-stats";
    stats.append(
      stat("Duração", formatDuration(record.activeMs)),
      stat("Alertas", String(record.alerts)),
      stat("Boa postura", formatDuration(record.goodMs), "good"),
      stat("Curvado", formatDuration(record.hunchedMs), "hunched"),
      stat("Boa / curvado", share ? `${share.good}% / ${share.hunched}%` : "—"),
    );

    item.append(head, stats);
    if (record.id !== currentId) {
      item.append(deleteButton(record, onDelete));
    }
    list.append(item);
  }
  container.append(list);
}
