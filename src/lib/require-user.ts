import { getSession } from "@/lib/auth/session";

export async function requireUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.userId ?? null;
}
