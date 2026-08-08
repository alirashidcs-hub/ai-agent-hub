import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";
import { TOOLS } from "@/lib/tools";

// Ensures the built-in tool catalog exists as DB rows (so enable/disable
// state persists) without needing a separate seed step on first run.
async function ensureBuiltInTools() {
  for (const tool of TOOLS) {
    await prisma.tool.upsert({
      where: { key: tool.key },
      update: {},
      create: {
        key: tool.key,
        name: tool.name,
        description: tool.description,
        icon: tool.icon,
        builtIn: true,
      },
    });
  }
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureBuiltInTools();
  const tools = await prisma.tool.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(tools);
}

const toggleSchema = z.object({ key: z.string(), enabled: z.boolean() });

export async function PATCH(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = toggleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const tool = await prisma.tool.update({ where: { key: parsed.data.key }, data: { enabled: parsed.data.enabled } });
  return NextResponse.json(tool);
}
