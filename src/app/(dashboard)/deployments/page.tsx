"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket, Copy, Check } from "lucide-react";

interface AgentRow {
  id: string; name: string;
  deployment: { status: "ACTIVE" | "DISABLED"; endpointSlug: string } | null;
}

export default function DeploymentsPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function load() { fetch("/api/agents").then((r) => r.json()).then(setAgents); }
  useEffect(load, []);

  async function deploy(agentId: string) {
    await fetch(`/api/deployments/${agentId}`, { method: "POST" });
    load();
  }

  async function toggle(agentId: string, status: "ACTIVE" | "DISABLED") {
    await fetch(`/api/deployments/${agentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  function endpointUrl(slug: string) {
    return `${origin}/api/deploy/${slug}/run`;
  }

  function copyEndpoint(agentId: string, slug: string) {
    navigator.clipboard.writeText(endpointUrl(slug));
    setCopiedId(agentId);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold tracking-tight">Deployments</h1>
      <p className="text-sm text-ink-mid mt-1 mb-6">
        Turn an agent into a hosted API endpoint. Calls require an API key — create one on the
        API Keys page, scoped to this agent for least privilege.
      </p>

      <div className="flex flex-col gap-3">
        {agents.map((a) => (
          <Card key={a.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo/10 text-indigo flex items-center justify-center">
                <Rocket size={16} />
              </div>
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                {a.deployment ? (
                  <button onClick={() => copyEndpoint(a.id, a.deployment!.endpointSlug)} className="text-xs text-ink-faint font-mono flex items-center gap-1 mt-0.5 hover:text-ink">
                    POST /api/deploy/{a.deployment.endpointSlug}/run {copiedId === a.id ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                ) : (
                  <p className="text-xs text-ink-faint mt-0.5">Not deployed</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {a.deployment && (
                <span className={`text-xs px-2 py-1 rounded-md ${a.deployment.status === "ACTIVE" ? "bg-brand-green/10 text-brand-green" : "bg-white/5 text-ink-faint"}`}>
                  {a.deployment.status}
                </span>
              )}
              {!a.deployment && <Button variant="primary" onClick={() => deploy(a.id)}>Deploy</Button>}
              {a.deployment?.status === "ACTIVE" && <Button variant="danger" onClick={() => toggle(a.id, "DISABLED")}>Disable</Button>}
              {a.deployment?.status === "DISABLED" && <Button variant="secondary" onClick={() => toggle(a.id, "ACTIVE")}>Enable</Button>}
            </div>
          </Card>
        ))}
        {agents.length === 0 && <Card className="text-center py-12 text-sm text-ink-faint">No agents to deploy yet.</Card>}
      </div>
    </div>
  );
}
