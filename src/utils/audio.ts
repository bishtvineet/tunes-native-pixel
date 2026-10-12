export function formatDuration(seconds: number | string | undefined | null): string {
  if (seconds === undefined || seconds === null) {
    return '--:--';
  }

  // If already formatted like "03:45" or "1:02:15"
  if (typeof seconds === 'string' && seconds.includes(':')) {
    return seconds.trim();
  }

  const rawNum = typeof seconds === 'string' ? parseFloat(seconds) : seconds;
  if (isNaN(rawNum) || rawNum <= 0) {
    return '--:--';
  }

  // Normalize milliseconds if greater than 1000
  const totalSecs = rawNum > 1000 ? Math.floor(rawNum / 1000) : Math.floor(rawNum);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}