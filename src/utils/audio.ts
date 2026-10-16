/**
 * Safely parses heterogeneous duration inputs (seconds, milliseconds, strings like "03:45" or "1:02:15")
 * into normalized integer seconds.
 */
export function parseDurationToSeconds(input: unknown): number {
  if (input === undefined || input === null) return 0;

  if (typeof input === 'number') {
    if (isNaN(input) || input <= 0) return 0;
    return input > 1000 ? Math.floor(input / 1000) : Math.floor(input);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':').map((p) => parseInt(p, 10) || 0);
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
    }

    const parsed = parseFloat(trimmed);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed > 1000 ? Math.floor(parsed / 1000) : Math.floor(parsed);
    }
  }

  return 0;
}

/**
 * Formats duration into digital clock representation (e.g. "03:45" or "1:02:15").
 */
export function formatDuration(seconds: number | string | undefined | null): string {
  if (seconds === undefined || seconds === null) {
    return '--:--';
  }

  if (typeof seconds === 'string' && seconds.includes(':')) {
    return seconds.trim();
  }

  const rawNum = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
  if (isNaN(rawNum) || rawNum <= 0) {
    return '--:--';
  }

  const totalSecs = rawNum > 1000 ? Math.floor(rawNum / 1000) : Math.floor(rawNum);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}