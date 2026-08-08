import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

// Used for: rate limiting, caching model/tool responses, and holding
// short-lived agent run state.
export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    tls: process.env.REDIS_URL?.startsWith("redis://")
      ? {}
      : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}