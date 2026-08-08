import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";

export default async function SettingsPage() {
  const session = await getSession();
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      <p className="text-sm text-ink-mid mt-1 mb-6">Account and workspace preferences.</p>

      <Card className="flex flex-col gap-4">
        <div>
          <label className="text-xs text-ink-faint">Name</label>
          <p className="text-sm mt-1">{session?.name ?? "—"}</p>
        </div>
        <div>
          <label className="text-xs text-ink-faint">Email</label>
          <p className="text-sm mt-1">{session?.email}</p>
        </div>
      </Card>
    </div>
  );
}
