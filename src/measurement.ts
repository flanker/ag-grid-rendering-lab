export type Timing = {
  durationMs: number;
  intervals: number[];
  longTasks: { start: number; duration: number }[];
  longTaskSupported: boolean;
  p50: number;
  p95: number;
  max: number;
  kind: string;
};
export function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
    : 0;
}
export function startTiming() {
  const start = performance.now();
  const intervals: number[] = [];
  const longTasks: Timing["longTasks"] = [];
  let previous = 0;
  let frame = 0;
  const sample = (t: number) => {
    if (previous) intervals.push(t - previous);
    previous = t;
    frame = requestAnimationFrame(sample);
  };
  frame = requestAnimationFrame(sample);
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      if (entry.startTime >= start)
        longTasks.push({
          start: entry.startTime - start,
          duration: entry.duration,
        });
  });
  const longTaskSupported =
    PerformanceObserver.supportedEntryTypes.includes("longtask");
  if (longTaskSupported) observer.observe({ type: "longtask" });
  return () => {
    cancelAnimationFrame(frame);
    for (const entry of observer.takeRecords())
      if (entry.startTime >= start)
        longTasks.push({
          start: entry.startTime - start,
          duration: entry.duration,
        });
    observer.disconnect();
    return {
      durationMs: performance.now() - start,
      intervals,
      longTasks,
      longTaskSupported,
      p50: percentile(intervals, 0.5),
      p95: percentile(intervals, 0.95),
      max: Math.max(0, ...intervals),
      kind: "Main-thread requestAnimationFrame callback intervals; not displayed FPS",
    };
  };
}
export function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
