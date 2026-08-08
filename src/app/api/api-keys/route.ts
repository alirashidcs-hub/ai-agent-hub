import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";
import { generateApiKey, hashApiKey } from "@/lib/crypto";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const keys = await prisma.aPIKey.findMany({
    where: { userId, revoked: false },
    select: { id: true, name: true, keyPrefix: true, createdAt: true, lastUsedAt: true, agentId: true, agent: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(keys);
}

const createSchema = z.object({ name: z.string().min(1).max(100), agentId: z.string().optional() });

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit("api-key-create", userId, RATE_LIMITS.apiKeyCreate.limit, RATE_LIMITS.apiKeyCreate.windowSeconds);
  if (!rl.allowed) return rateLimitResponse(rl);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Agent-scoped keys must reference an agent the caller actually owns —
  // otherwise a key could be minted that's scoped to someone else's agent
  // (it just wouldn't work, but fail loudly instead of silently).
  if (parsed.data.agentId) {
    const owned = await prisma.agent.findFirst({ where: { id: parsed.data.agentId, project: { userId } } });
    if (!owned) return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  }

  const { full, prefix } = generateApiKey();
  const record = await prisma.aPIKey.create({
    data: { userId, name: parsed.data.name, keyPrefix: prefix, hashedKey: hashApiKey(full), agentId: parsed.data.agentId },
  });

  // The full key is only ever shown once, in this response.
  return NextResponse.json({ id: record.id, name: record.name, key: full, keyPrefix: prefix, agentId: record.agentId }, { status: 201 });
}
