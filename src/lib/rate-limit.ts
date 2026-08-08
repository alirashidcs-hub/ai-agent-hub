import { redis } from "@/lib/redis";

/**
 * Fixed-window rate limiter backed by Redis. Used to throttle login,
 * registration, agent execution, API key creation, and MCP connection
 * testing (see call sites in src/app/api/**).
 *
 * Fails OPEN (allows the request) if Redis is unreachable, so a Redis
 * outage degrades to "no rate limiting" rather than taking the app down —
 * but Redis itself is still a required piece of infrastructure for this
 * to actually protect the app in production. See README "Redis" section.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

export async function checkRateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const key = `ratelimit:${bucket}:${identifier}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    const ttl = await redis.ttl(key);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (err) {
    console.error(`[rate-limit] Redis unavailable, failing open for bucket "${bucket}":`, err);
    return { allowed: true, remaining: limit, resetSeconds: windowSeconds };
  }
}

export function rateLimitResponse(result: RateLimitResult) {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly." }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(result.resetSeconds),
    },
  });
}

/** Best-effort client IP extraction behind Vercel's proxy. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 60 },
  register: { limit: 5, windowSeconds: 60 * 10 },
  agentRun: { limit: 30, windowSeconds: 60 },
  apiKeyCreate: { limit: 10, windowSeconds: 60 * 60 },
  mcpTest: { limit: 20, windowSeconds: 60 },
} as const;
