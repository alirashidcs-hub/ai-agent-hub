"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Wrench, Clock, Zap, AlertTriangle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface AgentOption { id: string; name: string; }
interface ChatEntry {
  role: "user" | "assistant";
  text: string;
  toolCalls?: { tool: string; input: unknown; output?: unknown }[];
  error?: string;
  durationMs?: number;
  tokensUsed?: number;
}

function PlaygroundInner() {
  const searchParams = useSearchParams();
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentId, setAgentId] = useState<string>(searchParams.get("agent") ?? "");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then((list) => {
      setAgents(list);
      if (!agentId && list[0]) setAgentId(list[0].id);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history]);

  async function send() {
    if (!input.trim() || !agentId || running) return;
    const userMessage = input;
    setInput("");
    setHistory((h) => [...h, { role: "user", text: userMessage }]);
    setRunning(true);
    const started = Date.now();

    const assistantEntry: ChatEntry = { role: "assistant", text: "", toolCalls: [] };
    setHistory((h) => [...h, assistantEntry]);

    try {
      const res = await fetch(`/api/agents/${agentId}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!res.body) throw new Error("No response stream from server.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          const evt = JSON.parse(dataLine.slice(5).trim());

          setHistory((h) => {
            const copy = [...h];
            const last = { ...copy[copy.length - 1] };
            if (evt.type === "token") last.text += evt.text;
            if (evt.type === "tool_call") last.toolCalls = [...(last.toolCalls ?? []), { tool: evt.tool, input: evt.input }];
            if (evt.type === "tool_result") {
              last.toolCalls = (last.toolCalls ?? []).map((tc, i) =>
                i === (last.toolCalls?.length ?? 1) - 1 ? { ...tc, output: evt.output } : tc
              );
            }
            if (evt.type === "run_complete") {
              last.tokensUsed = evt.tokensUsed;
              last.durationMs = Date.now() - started;
              if (!last.text) last.text = evt.output;
            }
            if (evt.type === "error") last.error = evt.message;
            copy[copy.length - 1] = last;
            return copy;
          });
        }
      }
    } catch (err) {
      setHistory((h) => {
        const copy = [...h];
        copy[copy.length - 1] = { ...copy[copy.length - 1], error: err instanceof Error ? err.message : "Run failed" };
        return copy;
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-8 flex flex-col h-screen max-h-screen">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Playground</h1>
          <p className="text-sm text-ink-mid mt-1">Test an agent with streaming responses and tool calls.</p>
        </div>
        <select
          className="px-3 py-2 text-sm rounded-lg bg-bg-soft border border-border text-ink"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        >
          {agents.length === 0 && <option value="">No agents yet</option>}
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
          {history.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-sm text-ink-faint">
              Send a message to test your agent.
            </div>
          )}
          {history.map((h, i) => (
            <div key={i} className={`max-w-[75%] ${h.role === "user" ? "self-end" : "self-start"}`}>
              <div className={`px-4 py-2.5 rounded-2xl text-sm ${h.role === "user" ? "bg-brand-gradient text-white" : "bg-bg-soft border border-border text-ink"}`}>
                {h.text || (running && i === history.length - 1 ? <Loader2 className="animate-spin" size={14} /> : "")}
              </div>

              {!!h.toolCalls?.length && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {h.toolCalls.map((tc, j) => (
                    <div key={j} className="text-xs px-3 py-2 rounded-lg bg-white/5 border border-border flex items-start gap-2">
                      <Wrench size={12} className="mt-0.5 text-brand-amber shrink-0" />
                      <div>
                        <span className="text-ink-mid">{tc.tool}</span>
                        {tc.output !== undefined && <span className="text-ink-faint"> → {JSON.stringify(tc.output).slice(0, 120)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {h.error && (
                <div className="mt-2 text-xs px-3 py-2 rounded-lg bg-brand-red/10 border border-brand-red/20 text-brand-red flex items-start gap-2">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {h.error}
                </div>
              )}

              {(h.durationMs || h.tokensUsed) && (
                <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-faint">
                  {h.durationMs && <span className="flex items-center gap-1"><Clock size={10} /> {(h.durationMs / 1000).toFixed(1)}s</span>}
                  {h.tokensUsed !== undefined && <span className="flex items-center gap-1"><Zap size={10} /> {h.tokensUsed} tokens</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-4 border-t border-border mt-4 shrink-0">
          <input
            className="flex-1 px-3 py-2.5 text-sm rounded-xl bg-bg-soft border border-border text-ink placeholder:text-ink-faint outline-none focus:border-indigo"
            placeholder="Send a message to your agent…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            disabled={!agentId || running}
          />
          <button
            onClick={send}
            disabled={!agentId || running || !input.trim()}
            className="w-10 h-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center disabled:opacity-50"
          >
            {running ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
          </button>
        </div>
      </Card>
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <Suspense fallback={null}>
      <PlaygroundInner />
    </Suspense>
  );
}
