"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Wrench, Search, Globe, Database, Mail, FileSearch, Code, Plug, Calculator } from "lucide-react";

const ICONS: Record<string, any> = {
  calculator: Calculator, globe: Globe, search: Search, database: Database,
  mail: Mail, "file-search": FileSearch, code: Code, plug: Plug,
};

interface ToolRow { id: string; key: string; name: string; description: string; icon: string | null; enabled: boolean; builtIn: boolean; }

export default function ToolsPage() {
  const [tools, setTools] = useState<ToolRow[]>([]);

  useEffect(() => { fetch("/api/tools").then((r) => r.json()).then(setTools); }, []);

  async function toggle(key: string, enabled: boolean) {
    setTools((ts) => ts.map((t) => (t.key === key ? { ...t, enabled } : t)));
    await fetch("/api/tools", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key, enabled }),
    });
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold tracking-tight">Tools</h1>
      <p className="text-sm text-ink-mid mt-1 mb-6">Built-in tools available to every agent's Tool nodes.</p>

      <div className="grid grid-cols-3 gap-4">
        {tools.map((t) => {
          const Icon = ICONS[t.icon ?? ""] ?? Wrench;
          return (
            <Card key={t.key}>
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 rounded-lg bg-indigo/10 text-indigo flex items-center justify-center mb-3">
                  <Icon size={16} />
                </div>
                <button
                  onClick={() => toggle(t.key, !t.enabled)}
                  className={`w-9 h-5 rounded-full relative transition-colors ${t.enabled ? "bg-brand-gradient" : "bg-white/10"}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${t.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
              <h3 className="text-sm font-medium">{t.name}</h3>
              <p className="text-xs text-ink-faint mt-1 leading-relaxed">{t.description}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
