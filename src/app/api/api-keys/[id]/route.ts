import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const key = await prisma.aPIKey.findFirst({ where: { id, userId } });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.aPIKey.update({ where: { id }, data: { revoked: true } });
  return NextResponse.json({ ok: true });
}
