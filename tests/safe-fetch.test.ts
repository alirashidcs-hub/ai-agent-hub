import { describe, it, expect } from "vitest";
import { safeFetch, SsrfBlockedError } from "@/lib/security/safe-fetch";

describe("lib/security/safe-fetch — SSRF protection", () => {
  it("blocks localhost", async () => {
    await expect(safeFetch("http://localhost:6379/")).rejects.toThrow(SsrfBlockedError);
  });

  it("blocks loopback IP (127.0.0.1)", async () => {
    await expect(safeFetch("http://127.0.0.1:5432/")).rejects.toThrow(SsrfBlockedError);
  });

  it("blocks IPv6 loopback (::1)", async () => {
    await expect(safeFetch("http://[::1]:80/")).rejects.toThrow(SsrfBlockedError);
  });

  it("blocks the cloud metadata IP (169.254.169.254)", async () => {
    await expect(safeFetch("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(SsrfBlockedError);
  });

  it("blocks RFC1918 private ranges (10.x, 172.16-31.x, 192.168.x)", async () => {
    await expect(safeFetch("http://10.0.0.5/")).rejects.toThrow(SsrfBlockedError);
    await expect(safeFetch("http://172.16.0.5/")).rejects.toThrow(SsrfBlockedError);
    await expect(safeFetch("http://192.168.1.1/")).rejects.toThrow(SsrfBlockedError);
  });

  it("blocks non-http(s) protocols", async () => {
    await expect(safeFetch("file:///etc/passwd")).rejects.toThrow(SsrfBlockedError);
    await expect(safeFetch("gopher://127.0.0.1:70/")).rejects.toThrow(SsrfBlockedError);
  });

  it("blocks .internal / .local hostnames outright", async () => {
    await expect(safeFetch("http://service.internal/")).rejects.toThrow(SsrfBlockedError);
    await expect(safeFetch("http://printer.local/")).rejects.toThrow(SsrfBlockedError);
  });

  it("allows a real public HTTPS host and enforces the response-size cap", async () => {
    // registry.npmjs.org is reachable from this test environment's egress
    // allowlist and isn't rate-limited the way api.github.com's anonymous
    // quota is.
    const res = await safeFetch("https://registry.npmjs.org/react", { maxResponseBytes: 200, timeoutMs: 8000 });
    expect(res.status).toBe(200);
    expect(res.truncated).toBe(true);
    expect(res.text.length).toBeLessThanOrEqual(300); // capped, allowing for chunk-boundary overshoot
  });

  it("enforces a request timeout", async () => {
    // 1ms timeout against a real host should abort before completing.
    await expect(safeFetch("https://registry.npmjs.org/react", { timeoutMs: 1 })).rejects.toThrow(/timed out/i);
  });
});
