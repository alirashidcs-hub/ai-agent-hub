import { getModelAdapter, type ChatMessage, type ModelProviderKey } from "@/lib/models";
import { getTool } from "@/lib/tools";
import { callMCPTool } from "@/lib/mcp/client";

export const MAX_EXECUTION_STEPS = 50;
export const MAX_EXECUTION_MS = 55_000; // stay under Vercel's function duration budget — see run route's maxDuration

export interface RunnerNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, any>;
}

export interface RunnerEdge {
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
}

export type RunnerEvent =
  | { type: "node_start"; nodeId: string; nodeType: string; label: string }
  | { type: "token"; nodeId: string; text: string }
  | { type: "node_complete"; nodeId: string; output: unknown }
  | { type: "tool_call"; nodeId: string; tool: string; input: unknown }
  | { type: "tool_result"; nodeId: string; tool: string; output: unknown }
  | { type: "waiting_approval"; nodeId: string }
  | { type: "run_complete"; output: string; tokensUsed: number }
  | { type: "error"; nodeId?: string; message: string; code?: "MAX_STEPS_EXCEEDED" | "TIMEOUT" | "ABORTED" | "RUNTIME_ERROR" };

export interface ProviderResolver {
  (provider: ModelProviderKey): Promise<{ apiKey: string; model: string } | null>;
}

export interface McpServerResolver {
  (mcpServerId: string): Promise<{ url: string; headers: Record<string, string> } | null>;
}

interface RunContext {
  messages: ChatMessage[];
  variables: Record<string, unknown>;
  tokensUsed: number;
}

// Deliberately tiny, dependency-free expression evaluator for Condition/Router
// nodes. Supports `variables.x`, `output`, comparisons, &&/||, !, and string
// / number literals — enough for demo routing rules without eval()/Function()
// on raw, un-sanitized user input.
//
// Tokenizes the expression respecting quoted string literals (so letters
// *inside* a string like "go" are never mistaken for a variable reference),
// substitutes only genuine identifier tokens with JSON-safe literals of
// their resolved value, and validates every remaining punctuation/operator
// character against a strict allowlist before handing the reassembled
// string to Function() — never the caller's raw text.
function evalExpression(expr: string, ctx: RunContext): boolean {
  try {
    const scope = { variables: ctx.variables, output: ctx.variables["output"] };
    const tokenPattern = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[a-zA-Z_][a-zA-Z0-9_.]*|[^a-zA-Z_"']+/g;
    const tokens = expr.match(tokenPattern) ?? [];

    let safe = "";
    for (const tok of tokens) {
      if (tok.startsWith('"') || tok.startsWith("'")) {
        // Already a quoted string literal — re-emit as a normalized,
        // properly-escaped JSON string rather than passing raw text through.
        safe += JSON.stringify(tok.slice(1, -1));
      } else if (/^[a-zA-Z_]/.test(tok)) {
        if (["true", "false", "null", "undefined"].includes(tok)) {
          safe += tok;
        } else {
          const path = tok.split(".");
          let val: any = scope;
          for (const key of path) val = val?.[key];
          safe += JSON.stringify(val ?? null);
        }
      } else {
        // Operators/punctuation/whitespace/digits only — no letters can
        // reach this branch, so there's no way to smuggle an identifier or
        // function call through here.
        if (!/^[\d\s.,:{}\[\]()!=<>&|+\-*/%]*$/.test(tok)) throw new Error("Disallowed character in expression.");
        safe += tok;
      }
    }
    // eslint-disable-next-line no-new-func
    return Boolean(new Function(`return (${safe});`)());
  } catch {
    return false;
  }
}

function nextNodes(edges: RunnerEdge[], fromId: string, port: string): string[] {
  return edges.filter((e) => e.fromNodeId === fromId && e.fromPort === port).map((e) => e.toNodeId);
}

export async function* runAgent(params: {
  nodes: RunnerNode[];
  edges: RunnerEdge[];
  input: string;
  resolveProvider: ProviderResolver;
  resolveMcpServer?: McpServerResolver;
  signal?: AbortSignal;
}): AsyncGenerator<RunnerEvent> {
  const { nodes, edges, input, resolveProvider, resolveMcpServer, signal } = params;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const start = nodes.find((n) => n.type === "start");

  if (!start) {
    yield { type: "error", message: "Agent has no Start node.", code: "RUNTIME_ERROR" };
    return;
  }

  const ctx: RunContext = {
    messages: [{ role: "user", content: input }],
    variables: { input, output: input },
    tokensUsed: 0,
  };

  let currentIds: string[] = nextNodes(edges, start.id, "next");
  let finalOutput = input;
  let steps = 0;
  const deadline = Date.now() + MAX_EXECUTION_MS;

  while (currentIds.length) {
    if (signal?.aborted) {
      yield { type: "error", message: "Client disconnected — run aborted.", code: "ABORTED" };
      return;
    }
    if (Date.now() > deadline) {
      yield { type: "error", message: `Run exceeded the maximum execution time (${MAX_EXECUTION_MS / 1000}s).`, code: "TIMEOUT" };
      return;
    }
    if (steps >= MAX_EXECUTION_STEPS) {
      yield {
        type: "error",
        message: `Run exceeded the maximum step count (${MAX_EXECUTION_STEPS}). This usually means a loop in the graph — check Condition/Router edges.`,
        code: "MAX_STEPS_EXCEEDED",
      };
      return;
    }
    steps += 1;

    const nodeId = currentIds[0];
    const node = byId.get(nodeId);
    if (!node) break;

    yield { type: "node_start", nodeId: node.id, nodeType: node.type, label: node.label };

    try {
      if (node.type === "llm" || node.type === "agent") {
        const providerKey = (node.config.provider ?? "anthropic") as ModelProviderKey;
        const resolved = await resolveProvider(providerKey);
        if (!resolved) {
          yield { type: "error", nodeId: node.id, message: `No API key configured for provider "${providerKey}".`, code: "RUNTIME_ERROR" };
          return;
        }
        const adapter = getModelAdapter(providerKey);
        let text = "";
        for await (const chunk of adapter.streamChat({
          apiKey: resolved.apiKey,
          model: node.config.model ?? resolved.model,
          systemPrompt: node.config.systemPrompt,
          temperature: node.config.temperature ?? 0.7,
          maxTokens: node.config.maxTokens ?? 1024,
          messages: ctx.messages,
        })) {
          if (signal?.aborted) {
            yield { type: "error", nodeId: node.id, message: "Client disconnected — run aborted.", code: "ABORTED" };
            return;
          }
          if (chunk.type === "token" && chunk.text) {
            text += chunk.text;
            yield { type: "token", nodeId: node.id, text: chunk.text };
          }
          if (chunk.type === "error" && chunk.error) {
            yield { type: "error", nodeId: node.id, message: chunk.error, code: "RUNTIME_ERROR" };
            return;
          }
          if (chunk.type === "done" && chunk.usage) {
            ctx.tokensUsed += (chunk.usage.inputTokens ?? 0) + (chunk.usage.outputTokens ?? 0);
          }
        }
        ctx.messages.push({ role: "assistant", content: text });
        ctx.variables.output = text;
        finalOutput = text;
        yield { type: "node_complete", nodeId: node.id, output: text };
      } else if (["tool", "websearch", "http", "mcp"].includes(node.type)) {
        const toolKey =
          node.type === "websearch" ? "web_search" : node.type === "http" ? "http_request" : node.config.toolKey;

        yield { type: "tool_call", nodeId: node.id, tool: toolKey ?? node.type, input: node.config.input ?? ctx.variables.output };

        let result: unknown;
        if (node.type === "mcp") {
          if (!node.config.toolName) throw new Error("MCP node is missing a toolName configuration.");

          let serverUrl = node.config.serverUrl as string | undefined;
          let headers: Record<string, string> = {};

          if (node.config.mcpServerId && resolveMcpServer) {
            const server = await resolveMcpServer(node.config.mcpServerId);
            if (!server) throw new Error("Configured MCP server not found or not accessible.");
            serverUrl = server.url;
            headers = server.headers;
          }
          if (!serverUrl) throw new Error("MCP node is missing a server (select a saved MCP server or set serverUrl).");

          result = await callMCPTool(serverUrl, node.config.toolName, node.config.args ?? {}, headers);
        } else {
          const tool = getTool(toolKey);
          if (!tool) throw new Error(`Unknown tool "${toolKey}".`);
          result = await tool.run(node.config.input ?? { query: ctx.variables.output, expression: ctx.variables.output }, {
            config: node.config,
          });
        }

        yield { type: "tool_result", nodeId: node.id, tool: toolKey ?? node.type, output: result };
        ctx.variables.output = result;
        ctx.variables[`tool_${node.id}`] = result;
        yield { type: "node_complete", nodeId: node.id, output: result };
      } else if (node.type === "condition") {
        const expr = node.config.expression ?? "false";
        const pass = evalExpression(expr, ctx);
        yield { type: "node_complete", nodeId: node.id, output: { pass } };
        currentIds = nextNodes(edges, node.id, pass ? "true" : "false");
        continue;
      } else if (node.type === "router") {
        const port = node.config.selectPort ?? "a";
        yield { type: "node_complete", nodeId: node.id, output: { routedTo: port } };
        currentIds = nextNodes(edges, node.id, port);
        continue;
      } else if (node.type === "approval") {
        yield { type: "waiting_approval", nodeId: node.id };
        return;
      } else if (node.type === "memory" || node.type === "database") {
        // Pass-through: real implementations would read/write a vector
        // store or DB here based on node.config.
        yield { type: "node_complete", nodeId: node.id, output: ctx.variables.output };
      } else if (node.type === "output") {
        finalOutput = String(ctx.variables.output ?? finalOutput);
        yield { type: "node_complete", nodeId: node.id, output: finalOutput };
        yield { type: "run_complete", output: finalOutput, tokensUsed: ctx.tokensUsed };
        return;
      } else if (node.type === "code") {
        throw new Error("Code node execution is disabled in this deployment — no isolated sandbox is configured.");
      } else {
        yield { type: "node_complete", nodeId: node.id, output: null };
      }
    } catch (err) {
      yield { type: "error", nodeId: node.id, message: err instanceof Error ? err.message : "Node execution failed.", code: "RUNTIME_ERROR" };
      return;
    }

    currentIds = nextNodes(edges, node.id, "next");
  }

  // Loop ended because currentIds is empty — i.e. we reached a dangling
  // node with no outgoing "next" edge instead of hitting an Output node.
  yield { type: "run_complete", output: finalOutput, tokensUsed: ctx.tokensUsed };
}
