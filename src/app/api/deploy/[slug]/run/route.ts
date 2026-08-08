import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/crypto";
import { executeAgentRun, jsonError } from "@/lib/agent-runner/run-request";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/deploy/{endpointSlug}/run
 *
 * The **public** production endpoint for a deployed agent — this is the
 * URL shown on the Deployments page, distinct from the internal
 * /api/agents/{id}/run test endpoint. Looks up the agent by its
 * Deployment.endpointSlug (not by raw database id), and requires the
 * deployment to be ACTIVE.
 *
 * Auth: `Authorization: Bearer oas_sk_...` (required). The key must belong
 * to the deployment owner and be either account-wide or scoped to this
 * specific agent.
 *
 * Request:  { "message": "User message" }
 * Response (SSE): token | node_start | node_complete | tool_call |
 *                 tool_result | run_complete | error
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const deployment = await prisma.deployment.findUnique({ where: { endpointSlug: slug }, include: { agent: { include: { project: true } } } });
  if (!deployment) return jsonError("Deployment not found", 404);
  if (deployment.status !== "ACTIVE") return jsonError("This deployment is disabled.", 409);

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError("Missing Authorization: Bearer <api key> header.", 401);
  }
  const key = authHeader.slice(7);
  const apiKey = await prisma.aPIKey.findFirst({ where: { hashedKey: hashApiKey(key), revoked: false } });
  if (!apiKey) return jsonError("Invalid or revoked API key", 401);

  const ownerUserId = deployment.agent.project.userId;
  if (apiKey.userId !== ownerUserId) return jsonError("This API key cannot access this deployment.", 403);
  if (apiKey.agentId && apiKey.agentId !== deployment.agentId) {
    return jsonError("This API key is not scoped to this agent.", 403);
  }

  await prisma.aPIKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  const rl = await checkRateLimit("agent-run", apiKey.id, RATE_LIMITS.agentRun.limit, RATE_LIMITS.agentRun.windowSeconds);
  if (!rl.allowed) return rateLimitResponse(rl);

  const body = await req.json().catch(() => null);
  const message = body?.message;
  if (typeof message !== "string" || !message.trim()) {
    return jsonError('Request body must include a "message" string.', 400);
  }
  if (message.length > 20_000) {
    return jsonError("Message too long (max 20,000 characters).", 413);
  }

  return executeAgentRun({ agentId: deployment.agentId, userId: ownerUserId, message, signal: req.signal });
}
