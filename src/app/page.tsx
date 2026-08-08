import Link from "next/link";
import {
  Sparkles, GitBranch, Cpu, Plug, Wrench, Database, Rocket, Terminal, Github, ArrowRight,
} from "lucide-react";

const FEATURES = [
  { icon: GitBranch, title: "Visual Agent Builder", desc: "Drag, connect, and configure nodes on an infinite canvas — no boilerplate orchestration code." },
  { icon: Cpu, title: "Multi-Model Support", desc: "Route between Claude, GPT, and Gemini per-node, with rules for cost, latency, and capability." },
  { icon: Plug, title: "MCP Integration", desc: "Connect any Model Context Protocol server and drop its tools straight into your graph." },
  { icon: Wrench, title: "Powerful Tool Calling", desc: "Web search, HTTP, code, databases — built-in tools with typed input/output schemas." },
  { icon: Database, title: "Memory", desc: "Short-term, conversational, and persistent memory, with optional vector retrieval." },
  { icon: Rocket, title: "Production Deployment", desc: "Turn any agent into a hosted API endpoint with one click and a scoped key." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-gradient flex items-center justify-center">
            <Sparkles size={14} color="white" />
          </div>
          <span className="font-semibold tracking-tight">Open Agent Studio</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-ink-mid hover:text-ink">Sign in</Link>
          <Link href="/register" className="text-sm px-4 py-2 rounded-xl bg-brand-gradient text-white font-medium">
            Start Building
          </Link>
        </div>
      </header>

      <section className="max-w-4xl mx-auto text-center px-6 pt-20 pb-24">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs glass text-ink-mid mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-green" /> Open-source · MIT licensed
        </div>
        <h1 className="text-5xl font-semibold tracking-tight leading-tight">
          Build AI Agents <span className="bg-brand-gradient bg-clip-text text-transparent">Visually.</span>
        </h1>
        <p className="mt-5 text-lg text-ink-mid max-w-2xl mx-auto">
          Design, test, connect tools, configure models, and deploy production-ready AI agents
          from one powerful open-source platform.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/register" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-gradient text-white font-medium">
            Start Building <ArrowRight size={16} />
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl glass text-ink font-medium"
          >
            <Github size={16} /> View on GitHub
          </a>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="glass rounded-card p-2">
          <div className="rounded-[14px] bg-panel-solid h-80 flex items-center justify-center text-ink-faint text-sm">
            <div className="flex items-center gap-2"><Terminal size={16} /> Agent Builder canvas preview</div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-28 grid grid-cols-3 gap-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="glass rounded-card p-6">
            <div className="w-9 h-9 rounded-lg bg-indigo/10 text-indigo flex items-center justify-center mb-4">
              <f.icon size={17} />
            </div>
            <h3 className="font-medium mb-1.5">{f.title}</h3>
            <p className="text-sm text-ink-mid leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-ink-faint">
          <span>Open Agent Studio</span>
          <span>Built with Next.js, React Flow, and LangGraph.</span>
        </div>
      </footer>
    </div>
  );
}
