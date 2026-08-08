"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Bot, GitBranch, Wrench, Cpu, Database, Terminal,
  Rocket, Key, Settings, Sparkles, Command, LogOut, Plug,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/agents", label: "Agent Builder", icon: GitBranch, matchPrefix: "/agents" },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/mcp-servers", label: "MCP Servers", icon: Plug },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/memory", label: "Memory", icon: Database },
  { href: "/playground", label: "Playground", icon: Terminal },
  { href: "/deployments", label: "Deployments", icon: Rocket },
  { href: "/api-keys", label: "API Keys", icon: Key },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="w-56 shrink-0 flex flex-col p-3 glass rounded-none border-y-0 border-l-0">
      <div className="flex items-center gap-2 px-2 py-3 mb-2">
        <div className="w-7 h-7 rounded-lg bg-brand-gradient flex items-center justify-center">
          <Sparkles size={14} color="white" />
        </div>
        <span className="text-sm font-semibold tracking-tight">Open Agent Studio</span>
      </div>

      <div className="flex flex-col gap-0.5 flex-1">
        {NAV.map((item, i) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.label + i}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
                active ? "text-ink bg-indigo/15" : "text-ink-mid hover:text-ink hover:bg-white/5"
              }`}
            >
              <item.icon size={15} className={active ? "text-indigo" : "text-ink-faint"} />
              {item.label}
            </Link>
          );
        })}
      </div>

      <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-ink-faint border border-border mb-2">
        <Command size={12} /> K to search
      </button>
      <button onClick={logout} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-mid hover:text-ink hover:bg-white/5">
        <LogOut size={15} className="text-ink-faint" /> {userName ?? "Sign out"}
      </button>
    </div>
  );
}
