"use client";
import { Suspense, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface AgentOption { id: string; name: string; }
interface MemoryConfig {
  shortTerm: boolean; conversation: boolean; persistent: boolean; vectorSearch: boolean;
  embeddingModel: string; maxContext: number; retrievalTopK: number;
}

const DEFAULTS: MemoryConfig = {
  shortTerm: true, conversation: true, persistent: false, vectorSearch: false,
  embeddingModel: "text-embedding-3-small", maxContext: 8000, retrievalTopK: 5,
};

function MemoryInner() {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState("");
  const [config, setConfig] = useState<MemoryConfig>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then((list) => {
      setAgents(list);
      if (list[0]) setAgentId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!agentId) return;
    fetch(`/api/agents/${agentId}/memory`).then((r) => r.json()).then((m) => setConfig(m ? { ...DEFAULTS, ...m } : DEFAULTS));
  }, [agentId]);

  async function save() {
    setSaving(true);
    await fetch(`/api/agents/${agentId}/memory`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(config),
    });
    setSaving(false);
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Memory</h1>
          <p className="text-sm text-ink-mid mt-1">Configure how an agent remembers context across turns and runs.</p>
        </div>
        <select className="px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <Card className="flex flex-col gap-4">
        {[
          ["shortTerm", "Short-term memory", "Remember the current run's scratch state."],
          ["conversation", "Conversation memory", "Carry prior turns within a session."],
          ["persistent", "Persistent memory", "Store facts across sessions in the database."],
          ["vectorSearch", "Vector search", "Enable semantic retrieval over stored memory."],
        ].map(([key, label, desc]) => (
          <label key={key} className="flex items-center justify-between">
            <div>
              <p className="text-sm">{label}</p>
              <p className="text-xs text-ink-faint">{desc}</p>
            </div>
            <input
              type="checkbox"
              checked={(config as any)[key]}
              onChange={(e) => setConfig({ ...config, [key]: e.target.checked })}
            />
          </label>
        ))}

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
          <div>
            <label className="text-xs text-ink-faint">Embedding Model</label>
            <Input className="mt-1" value={config.embeddingModel} onChange={(e) => setConfig({ ...config, embeddingModel: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-ink-faint">Max Context (tokens)</label>
            <Input type="number" className="mt-1" value={config.maxContext} onChange={(e) => setConfig({ ...config, maxContext: Number(e.target.value) })} />
          </div>
          <div>
            <label className="text-xs text-ink-faint">Retrieval Top K</label>
            <Input type="number" className="mt-1" value={config.retrievalTopK} onChange={(e) => setConfig({ ...config, retrievalTopK: Number(e.target.value) })} />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={save} disabled={!agentId || saving}>{saving ? "Saving…" : "Save Memory Settings"}</Button>
        </div>
      </Card>
    </div>
  );
}

export default function MemoryPage() {
  return <Suspense fallback={null}><MemoryInner /></Suspense>;
}
