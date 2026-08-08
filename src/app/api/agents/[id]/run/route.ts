import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { hashApiKey } from "@/lib/crypto";
import { executeAgentRun, jsonError } from "@/lib/agent-runner/run-request";
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

// Node runtime required: this route uses ReadableStream + Prisma + the
// Node crypto module, none of which run on the Edge runtime.
export const runtime = "nodejs";
// Vercel per-route max duration (seconds). Raise this if your plan allows
// longer function execution — see MAX_EXECUTION_MS in lib/agent-runner/engine.ts,
// which is kept comfortably under this to leave room for cleanup.
export const maxDuration = 60;

/**
 * POST /api/agents/{agentId}/run
 *
 * This is the **internal** test-run endpoint used by the dashboard
 * Playground (session cookie auth). For the public, deployable production
 * endpoint use POST /api/deploy/{endpointSlug}/run instead — see
 * src/app/api/deploy/[slug]/run/route.ts.
 *
 * Auth: session cookie, OR an account-wide API key
 * (`Authorization: Bearer oas_sk_...` with no agent scope). An
 * agent-scoped key must match this agent's id or is rejected.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: agentId } = await params;

  let userId: string | null = null;

  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const key = authHeader.slice(7);
    const hashed = hashApiKey(key);
    const apiKey = await prisma.aPIKey.findFirst({ where: { hashedKey: hashed, revoked: false } });
    if (!apiKey) return jsonError("Invalid or revoked API key", 401);
    if (apiKey.agentId && apiKey.agentId !== agentId) {
      return jsonError("This API key is not scoped to this agent.", 403);
    }
    await prisma.aPIKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
    userId = apiKey.userId;
  } else {
    const session = await getSession();
    userId = session?.userId ?? null;
  }

  if (!userId) return jsonError("Unauthorized", 401);

  const rl = await checkRateLimit("agent-run", userId, RATE_LIMITS.agentRun.limit, RATE_LIMITS.agentRun.windowSeconds);
  if (!rl.allowed) return rateLimitResponse(rl);

  const body = await req.json().catch(() => null);
  const message = body?.message;
  if (typeof message !== "string" || !message.trim()) {
    return jsonError('Request body must include a "message" string.', 400);
  }
  if (message.length > 20_000) {
    return jsonError("Message too long (max 20,000 characters).", 413);
  }

  return executeAgentRun({ agentId, userId, message, signal: req.signal });
}
