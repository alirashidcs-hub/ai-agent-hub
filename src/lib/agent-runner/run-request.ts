import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { runAgent, MAX_EXECUTION_MS } from "@/lib/agent-runner/engine";
import { DEFAULT_MODELS, type ModelProviderKey } from "@/lib/models";

/**
 * Shared SSE-streaming execution path used by both:
 *  - POST /api/agents/{id}/run        (session-authed "Test Agent" in the Playground)
 *  - POST /api/deploy/{slug}/run      (public, API-key-authed production endpoint)
 *
 * Handles: Node runtime SSE streaming, client-disconnect propagation via
 * AbortSignal, a wall-clock execution deadline, ExecutionLog + AgentRun
 * persistence (including for TIMEOUT / MAX_STEPS_EXCEEDED / ABORTED runs),
 * and MCP server credential resolution.
 */
export async function executeAgentRun(opts: {
  agentId: string;
  userId: string;
  message: string;
  signal: AbortSignal;
}): Promise<Response> {
  const { agentId, userId, message, signal } = opts;

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, project: { userId } },
    include: { nodes: true, edges: true },
  });
  if (!agent) return jsonError("Agent not found", 404);
  if (!agent.isActive) return jsonError("This agent is inactive.", 409);

  const run = await prisma.agentRun.create({
    data: { agentId: agent.id, status: "RUNNING", input: { message } },
  });

  const resolveProvider = async (provider: ModelProviderKey) => {
    const record = await prisma.modelProvider.findFirst({ where: { userId, provider } });
    if (!record) return null;
    return { apiKey: decryptSecret(record.encryptedKey), model: record.defaultModel || DEFAULT_MODELS[provider][0] };
  };

  const resolveMcpServer = async (mcpServerId: string) => {
    const server = await prisma.mCPServer.findFirst({ where: { id: mcpServerId, userId } });
    if (!server || !server.encryptedHeaders) return server ? { url: server.url, headers: {} } : null;
    try {
      const headers = JSON.parse(decryptSecret(server.encryptedHeaders));
      return { url: server.url, headers };
    } catch {
      return { url: server.url, headers: {} };
    }
  };

  const encoder = new TextEncoder();
  let tokensUsed = 0;
  let finalOutput = "";
  let runStatus: "SUCCESS" | "ERROR" | "WAITING_APPROVAL" = "SUCCESS";
  let errorMessage: string | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const onAbort = () => {
        // The ReadableStream will be cancelled by the runtime; runAgent
        // also observes `signal` directly on each loop iteration/model
        // stream read so it stops promptly rather than running to completion
        // against a client that's gone.
      };
      signal.addEventListener("abort", onAbort);

      try {
        for await (const evt of runAgent({
          nodes: agent.nodes.map((n: any) => ({ id: n.id, type: n.type, label: n.label, config: n.config as Record<string, any> })),
          edges: agent.edges.map((e: any) => ({ fromNodeId: e.fromNodeId, fromPort: e.fromPort, toNodeId: e.toNodeId })),
          input: message,
          resolveProvider,
          resolveMcpServer,
          signal,
        })) {
          send(evt.type, evt);

          if (evt.type === "node_start" || evt.type === "node_complete" || evt.type === "tool_call" || evt.type === "tool_result") {
            await prisma.executionLog.create({
              data: {
                runId: run.id,
                nodeId: "nodeId" in evt ? evt.nodeId : undefined,
                nodeType: "nodeType" in evt ? evt.nodeType : undefined,
                event: evt.type,
                data: evt as unknown as object,
              },
            });
          }
          if (evt.type === "run_complete") {
            finalOutput = evt.output;
            tokensUsed = evt.tokensUsed;
          }
          if (evt.type === "error") {
            runStatus = "ERROR";
            errorMessage = evt.message;
            await prisma.executionLog.create({
              data: { runId: run.id, event: "error", message: evt.message, nodeId: evt.nodeId, data: { code: evt.code } },
            });
          }
          if (evt.type === "waiting_approval") {
            runStatus = "WAITING_APPROVAL";
          }
        }
      } catch (err) {
        runStatus = "ERROR";
        errorMessage = err instanceof Error ? err.message : "Unexpected error";
        send("error", { type: "error", message: errorMessage });
      } finally {
        signal.removeEventListener("abort", onAbort);
        await prisma.agentRun
          .update({
            where: { id: run.id },
            data: {
              status: runStatus,
              output: finalOutput ? { text: finalOutput } : undefined,
              error: errorMessage ?? undefined,
              tokensUsed,
              finishedAt: new Date(),
              durationMs: Date.now() - run.startedAt.getTime(),
            },
          })
          .catch(() => {
            // Best-effort — if the DB write fails here there's nothing more
            // useful we can do from inside the stream's finally block.
          });
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed (e.g. client disconnected)
        }
      }
    },
    cancel() {
      // Client disconnected before the stream finished — `signal` (tied to
      // the request) will already be aborted by the runtime in this case,
      // which the loop above observes on its next check.
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-run-id": run.id,
      "x-max-duration-ms": String(MAX_EXECUTION_MS),
    },
  });
}

export function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { "content-type": "application/json" } });
}
