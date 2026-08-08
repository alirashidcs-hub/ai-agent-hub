import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="flex h-screen bg-bg">
      <Sidebar userName={session?.name} />
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}
