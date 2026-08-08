import { safeFetch, SsrfBlockedError } from "@/lib/security/safe-fetch";

/**
 * Minimal MCP (Model Context Protocol) client over the streamable-HTTP
 * transport, using JSON-RPC 2.0 request/response framing. All requests go
 * through safeFetch, which blocks SSRF targets (localhost, private/link-
 * local ranges, cloud metadata IPs) and enforces a timeout + response cap.
 */

interface JsonRpcResponse<T> {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

async function rpcCall<T>(
  url: string,
  method: string,
  params: Record<string, unknown>,
  headers: Record<string, string> = {}
): Promise<T> {
  let res;
  try {
    res = await safeFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      timeoutMs: 8000,
      maxResponseBytes: 2_000_000,
    });
  } catch (err) {
    if (err instanceof SsrfBlockedError) throw new Error(`Blocked MCP server address: ${err.message}`);
    throw err;
  }
  if (res.status < 200 || res.status >= 300) throw new Error(`MCP server responded ${res.status}`);
  const json = JSON.parse(res.text) as JsonRpcResponse<T>;
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export async function testMCPConnection(url: string, headers: Record<string, string> = {}) {
  try {
    await rpcCall(url, "initialize", { protocolVersion: "2024-11-05", capabilities: {} }, headers);
    return { ok: true as const };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : "Connection failed" };
  }
}

export async function listMCPTools(url: string, headers: Record<string, string> = {}): Promise<MCPTool[]> {
  const result = await rpcCall<{ tools: MCPTool[] }>(url, "tools/list", {}, headers);
  return result.tools ?? [];
}

export async function callMCPTool(
  url: string,
  toolName: string,
  args: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  return rpcCall(url, "tools/call", { name: toolName, arguments: args }, headers);
}
