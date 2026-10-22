/**
 * A small fixed-window limiter for the chat endpoint.
 *
 * It lives in process memory, which is the honest choice for a POC that may be
 * deployed as a single instance: no external store, no extra permission. The
 * limits are therefore per instance, not global. If the service is ever scaled
 * beyond one instance, this must move to a shared store (Redis, Upstash, or a
 * database) or the effective rate multiplies by the instance count.
 */

type Window = { startedAt: number; count: number };

export type RateLimitDecision = {
  allowed: boolean;
  /** Seconds the caller should wait before retrying, when refused. */
  retryAfterSeconds: number;
};

export class FixedWindowLimiter {
  private readonly windows = new Map<string, Window>();
  private lastSweep = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitDecision {
    const current = this.now();
    this.sweep(current);

    const window = this.windows.get(key);
    if (!window || current - window.startedAt >= this.windowMs) {
      this.windows.set(key, { startedAt: current, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (window.count >= this.limit) {
      const remainingMs = this.windowMs - (current - window.startedAt);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
      };
    }

    window.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Drops expired windows so a flood of distinct IPs cannot grow memory. */
  private sweep(current: number) {
    if (current - this.lastSweep < this.windowMs) return;
    this.lastSweep = current;
    for (const [key, window] of this.windows) {
      if (current - window.startedAt >= this.windowMs) this.windows.delete(key);
    }
  }
}

/**
 * Best-effort client identity for rate limiting.
 *
 * Behind Scaleway Serverless Containers the connection arrives from the
 * platform, so `X-Real-IP` (and the first `X-Forwarded-For` entry) carry the
 * caller. Both are client-controlled when the service is reached directly, so
 * this is a fairness control, not an authentication boundary. The request cap
 * in the route is what bounds total cost.
 */
export function clientKey(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;

  return "unknown";
}
