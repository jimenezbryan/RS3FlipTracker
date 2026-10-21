// Calls fn; on failure waits delaysMs[i] and tries again, so it runs at most delaysMs.length + 1
// times. Rethrows the last error. `sleep` is injectable so tests don't wait.
export async function retry<T>(
  fn: () => Promise<T>,
  delaysMs: number[],
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<T> {
  for (const ms of delaysMs) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`[retry] failed (${(error as Error)?.message ?? error}); retrying in ${ms}ms`);
      await sleep(ms);
    }
  }
  return fn();
}
