"use client";
import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import { NODE_DEFS } from "./nodeDefs";

export interface EditableNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, any>;
}

export function ConfigPanel({
  node, onChange, onClose, onDelete,
}: {
  node: EditableNode;
  onChange: (n: EditableNode) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const def = NODE_DEFS[node.type];
  const setConfig = (patch: Record<string, any>) => onChange({ ...node, config: { ...node.config, ...patch } });

  const [mcpServers, setMcpServers] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (node.type !== "mcp") return;
    fetch("/api/mcp-servers").then((r) => r.json()).then(setMcpServers).catch(() => {});
  }, [node.type]);

  return (
    <div className="glass rounded-card w-72 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Node Settings</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => onDelete(node.id)} className="text-ink-faint hover:text-brand-red"><Trash2 size={14} /></button>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><X size={15} /></button>
        </div>
      </div>

      <div>
        <label className="text-xs text-ink-faint">Label</label>
        <Input className="mt-1" value={node.label} onChange={(e) => onChange({ ...node, label: e.target.value })} />
      </div>

      <div>
        <label className="text-xs text-ink-faint">Type</label>
        <div className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink-mid">{def?.label}</div>
      </div>

      {(node.type === "llm" || node.type === "agent") && (
        <>
          <div>
            <label className="text-xs text-ink-faint">Provider</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink"
              value={node.config.provider ?? "anthropic"}
              onChange={(e) => setConfig({ provider: e.target.value })}
            >
              <option value="anthropic">Anthropic Claude</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-ink-faint">Model</label>
            <Input className="mt-1" value={node.config.model ?? ""} placeholder="e.g. claude-sonnet-5" onChange={(e) => setConfig({ model: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-ink-faint">Temperature: {node.config.temperature ?? 0.7}</label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={node.config.temperature ?? 0.7}
              onChange={(e) => setConfig({ temperature: Number(e.target.value) })}
              className="w-full mt-2"
            />
          </div>
          <div>
            <label className="text-xs text-ink-faint">Max Tokens</label>
            <Input
              type="number" className="mt-1"
              value={node.config.maxTokens ?? 1024}
              onChange={(e) => setConfig({ maxTokens: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-ink-faint">System Prompt</label>
            <Textarea rows={4} className="mt-1" value={node.config.systemPrompt ?? ""} onChange={(e) => setConfig({ systemPrompt: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-mid">
            <input type="checkbox" checked={node.config.streaming ?? true} onChange={(e) => setConfig({ streaming: e.target.checked })} />
            Stream response
          </label>
        </>
      )}

      {node.type === "condition" && (
        <div>
          <label className="text-xs text-ink-faint">Expression</label>
          <Input
            className="mt-1 font-mono text-xs"
            placeholder="variables.output.length > 0"
            value={node.config.expression ?? ""}
            onChange={(e) => setConfig({ expression: e.target.value })}
          />
        </div>
      )}

      {node.type === "router" && (
        <div>
          <label className="text-xs text-ink-faint">Select Port</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink"
            value={node.config.selectPort ?? "a"}
            onChange={(e) => setConfig({ selectPort: e.target.value })}
          >
            <option value="a">a</option>
            <option value="b">b</option>
          </select>
        </div>
      )}

      {(node.type === "tool") && (
        <div>
          <label className="text-xs text-ink-faint">Tool</label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink"
            value={node.config.toolKey ?? "calculator"}
            onChange={(e) => setConfig({ toolKey: e.target.value })}
          >
            <option value="calculator">Calculator</option>
            <option value="http_request">HTTP Request</option>
            <option value="web_search">Web Search</option>
            <option value="database_query">Database Query</option>
            <option value="email">Email</option>
            <option value="file_search">File Search</option>
            <option value="code_execution">Code Execution</option>
            <option value="custom_api">Custom API</option>
          </select>
        </div>
      )}

      {node.type === "mcp" && (
        <>
          <div>
            <label className="text-xs text-ink-faint">Saved MCP Server</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink"
              value={node.config.mcpServerId ?? ""}
              onChange={(e) => setConfig({ mcpServerId: e.target.value || undefined })}
            >
              <option value="">— Enter URL manually below —</option>
              {mcpServers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <p className="text-[11px] text-ink-faint mt-1">
              Using a saved server keeps its auth headers encrypted server-side — configure servers on the MCP page.
            </p>
          </div>
          {!node.config.mcpServerId && (
            <div>
              <label className="text-xs text-ink-faint">MCP Server URL</label>
              <Input className="mt-1" placeholder="https://…" value={node.config.serverUrl ?? ""} onChange={(e) => setConfig({ serverUrl: e.target.value })} />
            </div>
          )}
          <div>
            <label className="text-xs text-ink-faint">Tool Name</label>
            <Input className="mt-1" value={node.config.toolName ?? ""} onChange={(e) => setConfig({ toolName: e.target.value })} />
          </div>
        </>
      )}

      {node.type === "http" && (
        <div>
          <label className="text-xs text-ink-faint">URL</label>
          <Input className="mt-1" placeholder="https://…" value={node.config.url ?? ""} onChange={(e) => setConfig({ input: { url: e.target.value, method: "GET" } })} />
        </div>
      )}
    </div>
  );
}
