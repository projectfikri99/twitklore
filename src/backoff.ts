const BASE_MS = 60_000;
const MAX_MS = 600_000;

/**
 * Backoff saat kena rate limit. attempt 0 -> 60s, 1 -> 3m, 2 -> 5m, ...
 * Cap di 10 menit. Rumus sengaja sama dengan upstream: 2*attempt*base + base.
 */
export function rateLimitDelay(attempt: number): number {
  const ms = 2 * attempt * BASE_MS + BASE_MS;
  return Math.min(ms, MAX_MS);
}
