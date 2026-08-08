import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projects = await prisma.project.findMany({
    where: { userId },
    include: { _count: { select: { agents: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(projects);
}

const createSchema = z.object({ name: z.string().min(1).max(100), description: z.string().max(500).optional() });

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const project = await prisma.project.create({ data: { ...parsed.data, userId } });
  return NextResponse.json(project, { status: 201 });
}
