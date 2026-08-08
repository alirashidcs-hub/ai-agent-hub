import { z } from "zod";
import { safeFetch, SsrfBlockedError } from "@/lib/security/safe-fetch";

export interface ToolDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  run: (input: unknown, ctx?: { config?: Record<string, unknown> }) => Promise<unknown>;
}

// --- Calculator: safe arithmetic evaluation (no eval/Function on user input) ---
function safeCalculate(expr: string): number {
  const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, "");
  if (!sanitized.trim()) throw new Error("Empty expression");
  const tokens = sanitized.match(/(\d+\.?\d*|[+\-*/().%])/g);
  if (!tokens) throw new Error("Invalid expression");
  const prec: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "%": 2 };
  const output: string[] = [];
  const ops: string[] = [];
  for (const t of tokens) {
    if (!isNaN(Number(t))) output.push(t);
    else if (t === "(") ops.push(t);
    else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") output.push(ops.pop()!);
      ops.pop();
    } else {
      while (ops.length && prec[ops[ops.length - 1]] >= prec[t]) output.push(ops.pop()!);
      ops.push(t);
    }
  }
  while (ops.length) output.push(ops.pop()!);

  const stack: number[] = [];
  for (const t of output) {
    if (!isNaN(Number(t))) stack.push(Number(t));
    else {
      const b = stack.pop()!;
      const a = stack.pop()!;
      stack.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : t === "/" ? a / b : a % b);
    }
  }
  return stack[0];
}

function wrapSsrf<T>(fn: () => Promise<T>): Promise<T> {
  return fn().catch((err) => {
    if (err instanceof SsrfBlockedError) throw new Error(`Blocked outbound request: ${err.message}`);
    throw err;
  });
}

export const TOOLS: ToolDefinition[] = [
  {
    key: "calculator",
    name: "Calculator",
    description: "Evaluate arithmetic expressions.",
    icon: "calculator",
    inputSchema: z.object({ expression: z.string() }),
    outputSchema: z.object({ result: z.number() }),
    run: async (input) => {
      const { expression } = z.object({ expression: z.string() }).parse(input);
      return { result: safeCalculate(expression) };
    },
  },
  {
    key: "http_request",
    name: "HTTP Request",
    description: "Make an HTTP request to an external URL.",
    icon: "globe",
    inputSchema: z.object({
      url: z.string().url(),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
      headers: z.record(z.string()).optional(),
      body: z.string().optional(),
    }),
    outputSchema: z.object({ status: z.number(), body: z.string(), truncated: z.boolean() }),
    run: async (input) =>
      wrapSsrf(async () => {
        const parsed = z
          .object({
            url: z.string().url(),
            method: z.enum(["GET", "POST", "PUT", "DELETE"]).default("GET"),
            headers: z.record(z.string()).optional(),
            body: z.string().optional(),
          })
          .parse(input);
        const res = await safeFetch(parsed.url, {
          method: parsed.method,
          headers: parsed.headers,
          body: parsed.body,
          timeoutMs: 8000,
          maxResponseBytes: 500_000,
        });
        return { status: res.status, body: res.text.slice(0, 4000), truncated: res.truncated };
      }),
  },
  {
    key: "web_search",
    name: "Web Search",
    description: "Search the web for current information.",
    icon: "search",
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ results: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })) }),
    run: async (input) => {
      const { query } = z.object({ query: z.string() }).parse(input);
      const apiKey = process.env.SEARCH_API_KEY;
      if (!apiKey) {
        return {
          results: [
            {
              title: "Web search not configured",
              url: "#",
              snippet: `Set SEARCH_API_KEY in .env to enable live results for: "${query}"`,
            },
          ],
        };
      }
      // Fixed, first-party provider domain — not user-controlled input, so
      // this call goes through the timeout/size-limited fetch but skips
      // full SSRF host validation (no arbitrary URL is ever reachable here).
      const res = await safeFetch(`https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(query)}`, {
        headers: { "Ocp-Apim-Subscription-Key": apiKey },
        timeoutMs: 8000,
        maxResponseBytes: 1_000_000,
      });
      const data = JSON.parse(res.text || "{}");
      const results = (data.webPages?.value ?? []).slice(0, 5).map((r: { name: string; url: string; snippet: string }) => ({
        title: r.name,
        url: r.url,
        snippet: r.snippet,
      }));
      return { results };
    },
  },
  {
    key: "database_query",
    name: "Database Query",
    description: "Run a read-only query against a connected database.",
    icon: "database",
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ rows: z.array(z.record(z.unknown())) }),
    run: async () => {
      throw new Error(
        "database_query requires a per-agent datasource connection — configure one in Tools > Database Query before use."
      );
    },
  },
  {
    key: "email",
    name: "Email",
    description: "Send an email via a configured provider (e.g. Resend, SES).",
    icon: "mail",
    inputSchema: z.object({ to: z.string().email(), subject: z.string(), body: z.string() }),
    outputSchema: z.object({ sent: z.boolean() }),
    run: async () => {
      throw new Error("email requires EMAIL_PROVIDER_API_KEY to be set in .env");
    },
  },
  {
    key: "file_search",
    name: "File Search",
    description: "Search files attached to the agent's knowledge base.",
    icon: "file-search",
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ matches: z.array(z.object({ file: z.string(), excerpt: z.string() })) }),
    run: async () => ({ matches: [] }),
  },
  {
    key: "code_execution",
    name: "Code Execution",
    description: "Execute a short code snippet in a sandboxed runtime.",
    icon: "code",
    inputSchema: z.object({ language: z.enum(["python", "javascript"]), code: z.string() }),
    outputSchema: z.object({ stdout: z.string(), stderr: z.string() }),
    run: async () => {
      // Deliberately disabled: Vercel's serverless runtime is not an
      // isolated sandbox, and this scaffold does not ship one. Do not
      // execute user-provided code here without adding a real isolate
      // (e.g. Firecracker/gVisor microVM or a dedicated sandbox service).
      throw new Error("code_execution is disabled — no isolated sandbox is configured for this deployment.");
    },
  },
  {
    key: "custom_api",
    name: "Custom API",
    description: "Call a user-defined API endpoint with a custom schema.",
    icon: "plug",
    inputSchema: z.record(z.unknown()),
    outputSchema: z.record(z.unknown()),
    run: async (input, ctx) =>
      wrapSsrf(async () => {
        const endpoint = ctx?.config?.endpoint as string | undefined;
        if (!endpoint) throw new Error("custom_api tool has no endpoint configured");
        const res = await safeFetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          timeoutMs: 8000,
          maxResponseBytes: 500_000,
        });
        try {
          return JSON.parse(res.text);
        } catch {
          return { status: res.status, body: res.text.slice(0, 4000) };
        }
      }),
  },
];

export function getTool(key: string): ToolDefinition | undefined {
  return TOOLS.find((t) => t.key === key);
}
