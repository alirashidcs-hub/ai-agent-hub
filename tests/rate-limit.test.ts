import { describe, it, expect, beforeAll, afterAll } from "vitest";

beforeAll(() => {
  process.env.REDIS_URL = "redis://localhost:6379";
});

describe("lib/rate-limit — Redis-backed rate limiting (real Redis)", () => {
  it("allows requests under the limit, then blocks once exceeded", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const bucket = `test-${Date.now()}`;
    const id = "user-a";

    for (let i = 0; i < 5; i++) {
      const r = await checkRateLimit(bucket, id, 5, 60);
      expect(r.allowed).toBe(true);
    }
    const sixth = await checkRateLimit(bucket, id, 5, 60);
    expect(sixth.allowed).toBe(false);
    expect(sixth.remaining).toBe(0);
  });

  it("tracks separate identifiers independently", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const bucket = `test-iso-${Date.now()}`;
    const a = await checkRateLimit(bucket, "user-x", 1, 60);
    const b = await checkRateLimit(bucket, "user-y", 1, 60);
    expect(a.allowed).toBe(true);
    expect(b.allowed).toBe(true); // different identifier, independent counter
    const aAgain = await checkRateLimit(bucket, "user-x", 1, 60);
    expect(aAgain.allowed).toBe(false);
  });

  it("tracks separate buckets independently (e.g. login vs agent-run)", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    const id = `user-${Date.now()}`;
    const login = await checkRateLimit("login", id, 1, 60);
    const run = await checkRateLimit("agent-run", id, 1, 60);
    expect(login.allowed).toBe(true);
    expect(run.allowed).toBe(true);
  });

  it("getClientIp extracts the first x-forwarded-for entry", async () => {
    const { getClientIp } = await import("@/lib/rate-limit");
    const req = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" } });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });
});

afterAll(async () => {
  const { redis } = await import("@/lib/redis");
  await redis.quit().catch(() => {});
});
