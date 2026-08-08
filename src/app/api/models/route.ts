import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/require-user";
import { encryptSecret } from "@/lib/crypto";
import { MODEL_PROVIDERS } from "@/lib/models";

// NOTE: raw API keys are never returned to the client — only `keyPreview`,
// a short, non-secret prefix captured at creation time (see POST below).
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const providers = await prisma.modelProvider.findMany({
    where: { userId },
    select: { id: true, provider: true, label: true, defaultModel: true, keyPreview: true, createdAt: true },
  });
  return NextResponse.json(providers);
}

const createSchema = z.object({
  provider: z.enum(MODEL_PROVIDERS),
  label: z.string().min(1),
  apiKey: z.string().min(1),
  defaultModel: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const provider = await prisma.modelProvider.create({
    data: {
      userId,
      provider: parsed.data.provider,
      label: parsed.data.label,
      defaultModel: parsed.data.defaultModel,
      encryptedKey: encryptSecret(parsed.data.apiKey),
      keyPreview: `${parsed.data.apiKey.slice(0, 6)}••••`,
    },
  });

  return NextResponse.json({ id: provider.id, provider: provider.provider, label: provider.label }, { status: 201 });
}
