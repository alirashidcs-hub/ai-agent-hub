import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

async function ownedAgent(id: string, userId: string) {
  return prisma.agent.findFirst({ where: { id, project: { userId } } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await ownedAgent(id, userId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memory = await prisma.memory.findUnique({ where: { agentId: id } });
  return NextResponse.json(memory);
}

const schema = z.object({
  shortTerm: z.boolean().optional(),
  conversation: z.boolean().optional(),
  persistent: z.boolean().optional(),
  vectorSearch: z.boolean().optional(),
  embeddingModel: z.string().optional(),
  maxContext: z.number().int().min(500).max(200000).optional(),
  retrievalTopK: z.number().int().min(1).max(50).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!(await ownedAgent(id, userId))) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const memory = await prisma.memory.upsert({
    where: { agentId: id },
    update: parsed.data,
    create: { agentId: id, ...parsed.data },
  });
  return NextResponse.json(memory);
}
