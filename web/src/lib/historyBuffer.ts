export type HistoryPoint<T> = {
  ts: number;
  value: T;
};

export function pushHistory<T>(history: Array<HistoryPoint<T>>, point: HistoryPoint<T>, limit = 120) {
  const next = history.length >= limit ? history.slice(history.length - limit + 1) : history.slice();
  next.push(point);
  return next;
}
