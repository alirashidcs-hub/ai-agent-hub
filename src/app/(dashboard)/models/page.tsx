"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cpu, Plus, ShieldCheck } from "lucide-react";

const PROVIDERS = [
  { key: "anthropic", label: "Anthropic Claude", models: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001"] },
  { key: "openai", label: "OpenAI", models: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-4o"] },
  { key: "gemini", label: "Google Gemini", models: ["gemini-3.6-flash", "gemini-3.1-pro", "gemini-3.5-flash-lite"] },
];

interface ProviderRow { id: string; provider: string; label: string; defaultModel: string; keyPreview: string; }

export default function ModelsPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [provider, setProvider] = useState("anthropic");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [defaultModel, setDefaultModel] = useState(PROVIDERS[0].models[0]);
  const [saving, setSaving] = useState(false);

  function load() { fetch("/api/models").then((r) => r.json()).then(setProviders); }
  useEffect(load, []);

  async function submit() {
    setSaving(true);
    await fetch("/api/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, label: label || `${provider} key`, apiKey, defaultModel }),
    });
    setSaving(false);
    setShowForm(false);
    setApiKey("");
    setLabel("");
    load();
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Models</h1>
          <p className="text-sm text-ink-mid mt-1">Configure model providers. Keys are encrypted and never sent to the browser.</p>
        </div>
        <Button variant="primary" onClick={() => setShowForm((s) => !s)}><Plus size={15} /> Add Provider</Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-ink-faint">Provider</label>
              <select
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink"
                value={provider}
                onChange={(e) => { setProvider(e.target.value); setDefaultModel(PROVIDERS.find((p) => p.key === e.target.value)!.models[0]); }}
              >
                {PROVIDERS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-faint">Default Model</label>
              <select className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)}>
                {PROVIDERS.find((p) => p.key === provider)!.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-ink-faint">Label</label>
              <Input className="mt-1" placeholder="Production key" value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-ink-faint">API Key</label>
              <Input type="password" className="mt-1" placeholder="sk-…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button variant="primary" onClick={submit} disabled={saving || !apiKey}>{saving ? "Saving…" : "Save Provider"}</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        {providers.map((p) => (
          <Card key={p.id}>
            <div className="w-9 h-9 rounded-lg bg-purple/10 text-purple flex items-center justify-center mb-3">
              <Cpu size={16} />
            </div>
            <h3 className="text-sm font-medium">{p.label}</h3>
            <p className="text-xs text-ink-faint mt-1">{p.defaultModel}</p>
            <div className="flex items-center gap-1.5 mt-3 text-xs text-brand-green">
              <ShieldCheck size={12} /> Key stored encrypted
            </div>
          </Card>
        ))}
        {providers.length === 0 && !showForm && (
          <Card className="col-span-3 text-center py-12 text-sm text-ink-faint">No providers configured yet.</Card>
        )}
      </div>
    </div>
  );
}
