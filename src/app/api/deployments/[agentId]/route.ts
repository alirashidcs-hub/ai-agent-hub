import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { agentId } = await params;

  const agent = await prisma.agent.findFirst({ where: { id: agentId, project: { userId } } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slug = `${agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;

  const deployment = await prisma.deployment.upsert({
    where: { agentId },
    update: { status: "ACTIVE" },
    create: { agentId, endpointSlug: slug },
  });

  return NextResponse.json(deployment, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ agentId: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { agentId } = await params;

  const agent = await prisma.agent.findFirst({ where: { id: agentId, project: { userId } } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { status } = await req.json();
  const deployment = await prisma.deployment.update({ where: { agentId }, data: { status } });
  return NextResponse.json(deployment);
}
