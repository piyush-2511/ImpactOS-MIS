import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { serverEnv } from '@/config/env';

/** Named limits used by auth flows. Window in seconds. */
export const LIMITS = {
  signup: { max: 5, window: 60 * 60 },
  login: { max: 10, window: 15 * 60 },
  usernameLogin: { max: 5, window: 15 * 60 },
  resendCode: { max: 5, window: 60 * 60 },
  passwordReset: { max: 5, window: 60 * 60 },
  slugCheck: { max: 60, window: 60 },
} as const;
export type LimitName = keyof typeof LIMITS;
export type LimitResult = { ok: boolean; retryAfter: number };

const limiters = new Map<LimitName, Ratelimit>();
const memory = new Map<string, number[]>();

function upstash(name: LimitName): Ratelimit | null {
  const env = serverEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return null;
  let l = limiters.get(name);
  if (!l) {
    const { max, window } = LIMITS[name];
    l = new Ratelimit({
      redis: new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }),
      limiter: Ratelimit.slidingWindow(max, `${window} s`),
      prefix: `ios:rl:${name}`,
    });
    limiters.set(name, l);
  }
  return l;
}

/**
 * Sliding-window rate limit. Uses Upstash Redis in production (shared across instances); falls back to an
 * in-memory window in local development only.
 */
export async function limit(name: LimitName, key: string): Promise<LimitResult> {
  const r = upstash(name);
  if (r) {
    const res = await r.limit(key);
    return { ok: res.success, retryAfter: res.success ? 0 : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) };
  }
  return memoryLimit(`${name}:${key}`, LIMITS[name].max, LIMITS[name].window);
}

export function memoryLimit(key: string, max: number, windowSec: number, now = Date.now()): LimitResult {
  const since = now - windowSec * 1000;
  const hits = (memory.get(key) ?? []).filter((t) => t > since);
  if (hits.length >= max) return { ok: false, retryAfter: Math.ceil((hits[0]! + windowSec * 1000 - now) / 1000) };
  hits.push(now);
  memory.set(key, hits);
  return { ok: true, retryAfter: 0 };
}
