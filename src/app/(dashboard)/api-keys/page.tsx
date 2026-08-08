"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Plus, Trash2, Copy } from "lucide-react";

interface KeyRow {
  id: string; name: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null;
  agentId: string | null; agent: { name: string } | null;
}
interface AgentOption { id: string; name: string; }

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [name, setName] = useState("");
  const [scopeAgentId, setScopeAgentId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  function load() {
    fetch("/api/api-keys").then((r) => r.json()).then(setKeys);
    fetch("/api/agents").then((r) => r.json()).then(setAgents);
  }
  useEffect(load, []);

  async function create() {
    setCreating(true);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name || "Untitled key", agentId: scopeAgentId || undefined }),
    });
    const data = await res.json();
    setCreating(false);
    setName("");
    setScopeAgentId("");
    setRevealedKey(data.key);
    load();
  }

  async function revoke(id: string) {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">API Keys</h1>
      <p className="text-sm text-ink-mid mt-1 mb-6">
        Used to call deployed agent endpoints via <code className="text-xs">Authorization: Bearer …</code>.
        Scope a key to a single agent for least-privilege access, or leave unscoped for account-wide use.
      </p>

      {revealedKey && (
        <Card className="mb-6 border-indigo/40">
          <p className="text-xs text-ink-mid mb-2">Copy this key now — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-bg-soft border border-border rounded-lg px-3 py-2 truncate">{revealedKey}</code>
            <Button onClick={() => navigator.clipboard.writeText(revealedKey)}><Copy size={13} /></Button>
          </div>
          <button className="text-xs text-ink-faint mt-3" onClick={() => setRevealedKey(null)}>Dismiss</button>
        </Card>
      )}

      <Card className="mb-6 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Input placeholder="Key name (e.g. Production)" value={name} onChange={(e) => setName(e.target.value)} />
          <select
            className="px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink shrink-0"
            value={scopeAgentId}
            onChange={(e) => setScopeAgentId(e.target.value)}
          >
            <option value="">Account-wide</option>
            {agents.map((a) => <option key={a.id} value={a.id}>Scoped: {a.name}</option>)}
          </select>
          <Button variant="primary" onClick={create} disabled={creating}><Plus size={14} /> Create</Button>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {keys.map((k) => (
          <Card key={k.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber/10 text-brand-amber flex items-center justify-center"><Key size={14} /></div>
              <div>
                <p className="text-sm">{k.name}</p>
                <p className="text-xs text-ink-faint font-mono">{k.keyPrefix}••••••••</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-ink-faint">{k.agent ? `Scoped: ${k.agent.name}` : "Account-wide"}</span>
              <span className="text-xs text-ink-faint">{k.lastUsedAt ? `Used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}</span>
              <button onClick={() => revoke(k.id)} className="text-ink-faint hover:text-brand-red"><Trash2 size={14} /></button>
            </div>
          </Card>
        ))}
        {keys.length === 0 && <Card className="text-center py-10 text-sm text-ink-faint">No API keys yet.</Card>}
      </div>
    </div>
  );
}
