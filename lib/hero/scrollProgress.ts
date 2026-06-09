// Pure mapping from scroll geometry to narrative progress.

export function scrollToProgress(
  scrollY: number,
  scrollHeight: number,
  viewportHeight: number,
): number {
  const range = scrollHeight - viewportHeight;
  if (range <= 0) return 0;
  const p = scrollY / range;
  return Math.max(0, Math.min(1, p));
}

export function progressToBeat(progress: number): 0 | 1 | 2 {
  if (progress < 1 / 3) return 0;
  if (progress < 2 / 3) return 1;
  return 2;
}
