"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Plus, GitBranch } from "lucide-react";

const TEMPLATES = [
  "Research Agent", "Customer Support Agent", "Web Search Agent", "Email Assistant",
  "Data Analysis Agent", "Coding Assistant", "Document Q&A Agent", "Multi-Agent Research System",
];

interface AgentRow {
  id: string;
  name: string;
  description?: string | null;
  project: { name: string };
  isActive: boolean;
  _count: { runs: number };
}

interface ProjectRow {
  id: string;
  name: string;
}

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const [a, p] = await Promise.all([fetch("/api/agents").then((r) => r.json()), fetch("/api/projects").then((r) => r.json())]);
    setAgents(a);
    setProjects(p);
    if (p[0]) setProjectId(p[0].id);
  }

  useEffect(() => { load(); }, []);

  async function createAgent() {
    setLoading(true);
    let pid = projectId;
    if (!pid && newProjectName) {
      const proj = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newProjectName }),
      }).then((r) => r.json());
      pid = proj.id;
    }
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name || template || "Untitled Agent", template, projectId: pid }),
    });
    setLoading(false);
    if (res.ok) {
      const agent = await res.json();
      router.push(`/agents/${agent.id}/builder`);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-ink-mid mt-1">Every agent across your projects</p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate((s) => !s)}>
          <Plus size={15} /> New Agent
        </Button>
      </div>

      {showCreate && (
        <Card className="mb-6">
          <h2 className="text-sm font-medium mb-4">Create an agent</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-ink-faint">Name</label>
              <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Agent" />
            </div>
            <div>
              <label className="text-xs text-ink-faint">Project</label>
              {projects.length ? (
                <select
                  className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              ) : (
                <Input className="mt-1" placeholder="New project name" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
              )}
            </div>
          </div>
          <p className="text-xs text-ink-faint mt-4 mb-2">Start from a template (optional)</p>
          <div className="grid grid-cols-4 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t}
                onClick={() => setTemplate(t === template ? null : t)}
                className={`text-left px-3 py-2 rounded-lg text-xs border ${
                  template === t ? "border-indigo text-ink bg-indigo/10" : "border-border text-ink-mid"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="primary" onClick={createAgent} disabled={loading}>
              {loading ? "Creating…" : "Create Agent"}
            </Button>
          </div>
        </Card>
      )}

      {agents.length === 0 ? (
        <Card className="text-center py-16">
          <Bot className="mx-auto mb-3 text-ink-faint" size={28} />
          <p className="text-sm text-ink-mid">No agents yet. Create one to open the visual builder.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {agents.map((a) => (
            <Card key={a.id} className="cursor-pointer" onClick={() => router.push(`/agents/${a.id}/builder`)}>
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple/10 text-purple flex items-center justify-center">
                  <GitBranch size={15} />
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-md ${a.isActive ? "bg-brand-green/10 text-brand-green" : "bg-white/5 text-ink-faint"}`}>
                  {a.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <h3 className="font-medium text-sm">{a.name}</h3>
              <p className="text-xs text-ink-faint mt-1">{a.project.name} · {a._count.runs} runs</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
