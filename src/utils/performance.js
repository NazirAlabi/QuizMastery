const isPerformanceAvailable = () =>
  import.meta.env.DEV && typeof window !== 'undefined' && typeof window.performance !== 'undefined';

export const measureAsync = async (label, callback) => {
  if (!isPerformanceAvailable()) {
    return callback();
  }

  const perf = window.performance;
  const startMark = `${label}-start`;
  const endMark = `${label}-end`;
  const measureName = `${label}-duration`;

  perf.mark(startMark);

  try {
    return await callback();
  } finally {
    perf.mark(endMark);
    perf.measure(measureName, startMark, endMark);

    const entries = perf.getEntriesByName(measureName);
    const duration = entries[entries.length - 1]?.duration;
    if (Number.isFinite(duration)) {
      console.info(`[perf] ${label}: ${duration.toFixed(2)}ms`);
    }

    perf.clearMarks(startMark);
    perf.clearMarks(endMark);
    perf.clearMeasures(measureName);
  }
};
