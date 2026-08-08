import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";
import { testMCPConnection, listMCPTools } from "@/lib/mcp/client";
import { encryptSecret } from "@/lib/crypto";
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";

// Never select/return `encryptedHeaders` — header *values* (which may be
// bearer tokens, API keys, etc.) must never reach the browser.
const SAFE_SELECT = {
  id: true, name: true, url: true, headerNames: true, status: true, tools: true, createdAt: true,
} as const;

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const servers = await prisma.mCPServer.findMany({ where: { userId }, select: SAFE_SELECT, orderBy: { createdAt: "desc" } });
  return NextResponse.json(servers);
}

const createSchema = z.object({ name: z.string().min(1), url: z.string().url(), headers: z.record(z.string()).default({}) });

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit("mcp-test", userId ?? getClientIp(req), RATE_LIMITS.mcpTest.limit, RATE_LIMITS.mcpTest.windowSeconds);
  if (!rl.allowed) return rateLimitResponse(rl);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const test = await testMCPConnection(parsed.data.url, parsed.data.headers);
  let tools: unknown[] = [];
  if (test.ok) {
    tools = await listMCPTools(parsed.data.url, parsed.data.headers).catch(() => []);
  }

  const server = await prisma.mCPServer.create({
    data: {
      userId,
      name: parsed.data.name,
      url: parsed.data.url,
      encryptedHeaders: encryptSecret(JSON.stringify(parsed.data.headers)),
      headerNames: Object.keys(parsed.data.headers),
      status: test.ok ? "connected" : "error",
      tools: tools as Prisma.InputJsonValue,
    },
    select: SAFE_SELECT,
  });
  return NextResponse.json({ ...server, connectionError: test.ok ? undefined : test.error }, { status: 201 });
}
