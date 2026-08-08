import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";
import { validateGraph, MAX_GRAPH_PAYLOAD_BYTES } from "@/lib/agent-runner/validate";

async function ownedAgent(id: string, userId: string) {
  return prisma.agent.findFirst({ where: { id, project: { userId } } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const agent = await prisma.agent.findFirst({
    where: { id, project: { userId } },
    include: { nodes: true, edges: true, deployment: true, memory: true },
  });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(agent);
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  nodes: z.array(z.unknown()).optional(),
  edges: z.array(z.unknown()).optional(),
});

// Full-graph save: the builder sends the complete node/edge set on every
// save, so we replace them transactionally rather than diffing client-side.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await ownedAgent(id, userId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_GRAPH_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Request payload too large." }, { status: 413 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  const { nodes, edges, ...rest } = parsed.data;

  let validatedGraph: { nodes: any[]; edges: any[] } | null = null;
  if (nodes) {
    const result = validateGraph({ nodes, edges: edges ?? [] });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    validatedGraph = result;
  }

  const agent = await prisma.$transaction(async (tx: any) => {
    if (Object.keys(rest).length) {
      await tx.agent.update({ where: { id }, data: rest });
    }
    if (validatedGraph) {
      await tx.agentEdge.deleteMany({ where: { agentId: id } });
      await tx.agentNode.deleteMany({ where: { agentId: id } });
      await tx.agentNode.createMany({
        data: validatedGraph.nodes.map((n) => ({
          id: n.id,
          agentId: id,
          type: n.type,
          label: n.label,
          positionX: n.positionX,
          positionY: n.positionY,
          config: n.config as object,
        })),
      });
      await tx.agentEdge.createMany({
        data: validatedGraph.edges.map((e) => ({ agentId: id, fromNodeId: e.fromNodeId, fromPort: e.fromPort, toNodeId: e.toNodeId })),
      });
    }
    return tx.agent.findUnique({ where: { id }, include: { nodes: true, edges: true } });
  });

  return NextResponse.json(agent);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await ownedAgent(id, userId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.agent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
