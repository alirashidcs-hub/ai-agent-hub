import { z } from "zod";

export const ALLOWED_NODE_TYPES = [
  "start", "llm", "agent", "tool", "mcp", "websearch", "http", "code",
  "condition", "router", "memory", "database", "approval", "output",
] as const;

export const MAX_NODES = 150;
export const MAX_EDGES = 400;
export const MAX_GRAPH_PAYLOAD_BYTES = 512_000;

const nodeSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(ALLOWED_NODE_TYPES),
  label: z.string().min(1).max(200),
  positionX: z.number().finite(),
  positionY: z.number().finite(),
  config: z.record(z.unknown()).default({}),
});

const edgeSchema = z.object({
  fromNodeId: z.string().min(1),
  fromPort: z.string().min(1).max(50).default("next"),
  toNodeId: z.string().min(1),
});

export interface GraphValidationError {
  ok: false;
  error: string;
}
export interface GraphValidationOk {
  ok: true;
  nodes: z.infer<typeof nodeSchema>[];
  edges: z.infer<typeof edgeSchema>[];
}

/**
 * Validates an agent graph payload before it's persisted. Called from the
 * agent PATCH (save) route. Keeps invalid/oversized/malformed graphs out of
 * the database entirely, rather than relying on the runner to fail safely
 * at execution time.
 */
export function validateGraph(input: unknown): GraphValidationOk | GraphValidationError {
  const payloadSize = Buffer.byteLength(JSON.stringify(input ?? {}), "utf8");
  if (payloadSize > MAX_GRAPH_PAYLOAD_BYTES) {
    return { ok: false, error: `Graph payload too large (${payloadSize} bytes, max ${MAX_GRAPH_PAYLOAD_BYTES}).` };
  }

  const bodySchema = z.object({
    nodes: z.array(nodeSchema).max(MAX_NODES, `Too many nodes (max ${MAX_NODES}).`),
    edges: z.array(edgeSchema).max(MAX_EDGES, `Too many edges (max ${MAX_EDGES}).`),
  });

  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid graph." };
  }
  const { nodes, edges } = parsed.data;

  const ids = new Set<string>();
  for (const n of nodes) {
    if (ids.has(n.id)) return { ok: false, error: `Duplicate node id: ${n.id}` };
    ids.add(n.id);
  }

  for (const e of edges) {
    if (!ids.has(e.fromNodeId)) return { ok: false, error: `Edge references unknown node: ${e.fromNodeId}` };
    if (!ids.has(e.toNodeId)) return { ok: false, error: `Edge references unknown node: ${e.toNodeId}` };
  }

  // Lightweight per-type config sanity checks — not exhaustive, but catches
  // the most common malformed configs before they hit the runner.
  for (const n of nodes) {
    if ((n.type === "llm" || n.type === "agent") && n.config.provider) {
      if (!["openai", "anthropic", "gemini"].includes(String(n.config.provider))) {
        return { ok: false, error: `Node "${n.label}" has an invalid provider.` };
      }
    }
    if (n.type === "condition" && n.config.expression && typeof n.config.expression !== "string") {
      return { ok: false, error: `Node "${n.label}" has an invalid expression.` };
    }
    if (n.type === "http" && n.config.input && typeof n.config.input === "object") {
      const url = (n.config.input as any).url;
      if (url && typeof url !== "string") return { ok: false, error: `Node "${n.label}" has an invalid URL.` };
    }
  }

  const startCount = nodes.filter((n) => n.type === "start").length;
  if (startCount > 1) return { ok: false, error: "A graph may only have one Start node." };

  return { ok: true, nodes, edges };
}
