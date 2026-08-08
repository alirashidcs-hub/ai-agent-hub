import dns from "node:dns/promises";
import net from "node:net";

/**
 * SSRF-hardened fetch wrapper used by every tool/integration that calls a
 * user-supplied URL: HTTP Request, Custom API, and the MCP client.
 *
 * Defends against:
 *  - non-http(s) schemes (file:, gopher:, etc.)
 *  - localhost / loopback
 *  - private (RFC1918), link-local, and cloud metadata IPs (169.254.169.254)
 *  - DNS rebinding (resolves the hostname and checks the *resolved* IP,
 *    not just the literal hostname string)
 *  - open-ended redirects (each redirect hop is re-validated)
 *  - hangs (timeout) and memory exhaustion (response size cap)
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"]);

function isPrivateOrReservedIp(ip: string): boolean {
  const type = net.isIP(ip);
  if (type === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 0) return true; // "this" network
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (type === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true; // loopback
    if (lower.startsWith("fe80:")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local (fc00::/7)
    if (lower.startsWith("::ffff:")) {
      // IPv4-mapped IPv6 — validate the embedded IPv4 address too
      return isPrivateOrReservedIp(lower.replace("::ffff:", ""));
    }
    return false;
  }
  return true; // couldn't parse — treat as unsafe
}

export class SsrfBlockedError extends Error {}

async function assertUrlIsSafe(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError("Invalid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfBlockedError(`Protocol "${url.protocol}" is not allowed.`);
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new SsrfBlockedError(`Host "${hostname}" is not allowed.`);
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) throw new SsrfBlockedError(`IP "${hostname}" is not allowed.`);
    return url;
  }

  // Resolve DNS ourselves and validate every returned address, so a
  // hostname that resolves to a private IP (DNS rebinding, or simply
  // "internal-service.mycompany.com" pointed at 10.x) is still blocked.
  let addresses: string[];
  try {
    const records = await dns.lookup(hostname, { all: true });
    addresses = records.map((r) => r.address);
  } catch {
    throw new SsrfBlockedError(`Could not resolve host "${hostname}".`);
  }
  if (addresses.length === 0 || addresses.some(isPrivateOrReservedIp)) {
    throw new SsrfBlockedError(`Host "${hostname}" resolves to a disallowed address.`);
  }

  return url;
}

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxRedirects?: number;
  maxResponseBytes?: number;
}

export interface SafeFetchResult {
  status: number;
  headers: Headers;
  text: string;
  truncated: boolean;
}

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { method = "GET", headers = {}, body, timeoutMs = 8000, maxRedirects = 3, maxResponseBytes = 1_000_000 } = opts;

  let currentUrl = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertUrlIsSafe(currentUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : body,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request timed out after ${timeoutMs}ms.`);
      }
      throw err;
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      currentUrl = new URL(res.headers.get("location")!, url).toString();
      continue;
    }

    // Enforce a response size cap by reading the stream manually.
    const reader = res.body?.getReader();
    let received = 0;
    let truncated = false;
    const chunks: Uint8Array[] = [];
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxResponseBytes) {
          truncated = true;
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");

    return { status: res.status, headers: res.headers, text, truncated };
  }

  throw new Error(`Too many redirects (max ${maxRedirects}).`);
}
