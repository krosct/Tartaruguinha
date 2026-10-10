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

export function renderHistory(
  container: HTMLElement,
  history: SessionRecord[],
  currentId: string | null,
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
    const started = new Date(record.startedAt);

    const item = document.createElement("li");
    item.className = "history-item";

    const head = document.createElement("div");
    head.className = "history-head";
    const when = document.createElement("span");
    when.className = "history-when";
    const date = started.toLocaleDateString("pt-BR");
    const time = started.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    when.textContent = `${date} às ${time}`;
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
    list.append(item);
  }
  container.append(list);
}
