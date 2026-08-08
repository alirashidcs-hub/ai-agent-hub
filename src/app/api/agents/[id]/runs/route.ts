import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const agent = await prisma.agent.findFirst({ where: { id, project: { userId } } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const runs = await prisma.agentRun.findMany({
    where: { agentId: id },
    orderBy: { startedAt: "desc" },
    take: 50,
    include: { logs: { orderBy: { createdAt: "asc" } } },
  });
  return NextResponse.json(runs);
}
