import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agents = await prisma.agent.findMany({
    where: { project: { userId } },
    include: { project: { select: { name: true } }, deployment: true, _count: { select: { runs: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(agents);
}

const START_TEMPLATE = [
  { id: "start", type: "start", label: "Start", positionX: 60, positionY: 160, config: {} },
  { id: "output", type: "output", label: "Output", positionX: 520, positionY: 160, config: {} },
];

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  projectId: z.string(),
  template: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const project = await prisma.project.findFirst({ where: { id: parsed.data.projectId, userId } });
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const agent = await prisma.agent.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      template: parsed.data.template,
      projectId: project.id,
      nodes: {
        create: START_TEMPLATE.map((n) => ({ type: n.type, label: n.label, positionX: n.positionX, positionY: n.positionY, config: n.config })),
      },
    },
    include: { nodes: true },
  });

  const [startNode, outputNode] = agent.nodes;
  await prisma.agentEdge.create({
    data: { agentId: agent.id, fromNodeId: startNode.id, fromPort: "next", toNodeId: outputNode.id },
  });

  return NextResponse.json(agent, { status: 201 });
}
