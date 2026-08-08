"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plug, Plus, Trash2, CheckCircle2, XCircle } from "lucide-react";

interface ServerRow {
  id: string; name: string; url: string; status: string; headerNames: string[]; tools: { name: string }[];
}

export default function McpServersPage() {
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [headerKey, setHeaderKey] = useState("Authorization");
  const [headerValue, setHeaderValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() { fetch("/api/mcp-servers").then((r) => r.json()).then(setServers); }
  useEffect(load, []);

  async function create() {
    setCreating(true);
    setError(null);
    const headers = headerValue ? { [headerKey]: headerValue } : {};
    const res = await fetch("/api/mcp-servers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, url, headers }),
    });
    setCreating(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add server.");
      return;
    }
    if (data.connectionError) setError(`Added, but connection test failed: ${data.connectionError}`);
    setName(""); setUrl(""); setHeaderValue("");
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/mcp-servers/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">MCP Servers</h1>
      <p className="text-sm text-ink-mid mt-1 mb-6">
        Connect Model Context Protocol servers. Auth headers are encrypted at rest and never sent to the browser again after creation.
      </p>

      <Card className="mb-6 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="https://mcp.example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input placeholder="Header name (optional)" value={headerKey} onChange={(e) => setHeaderKey(e.target.value)} />
          <Input type="password" placeholder="Header value (optional)" value={headerValue} onChange={(e) => setHeaderValue(e.target.value)} />
        </div>
        {error && <p className="text-xs text-brand-red">{error}</p>}
        <div className="flex justify-end">
          <Button variant="primary" onClick={create} disabled={creating || !name || !url}><Plus size={14} /> Add Server</Button>
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        {servers.map((s) => (
          <Card key={s.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan/10 text-cyan flex items-center justify-center"><Plug size={14} /></div>
              <div>
                <p className="text-sm">{s.name}</p>
                <p className="text-xs text-ink-faint font-mono">{s.url}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {s.status === "connected" ? (
                <span className="text-xs text-brand-green flex items-center gap-1"><CheckCircle2 size={12} /> Connected</span>
              ) : (
                <span className="text-xs text-brand-red flex items-center gap-1"><XCircle size={12} /> {s.status}</span>
              )}
              <button onClick={() => remove(s.id)} className="text-ink-faint hover:text-brand-red"><Trash2 size={14} /></button>
            </div>
          </Card>
        ))}
        {servers.length === 0 && <Card className="text-center py-10 text-sm text-ink-faint">No MCP servers connected yet.</Card>}
      </div>
    </div>
  );
}
