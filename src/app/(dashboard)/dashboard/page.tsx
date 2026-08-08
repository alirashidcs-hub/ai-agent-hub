import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Zap, Wrench, Activity, Clock } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getSession();
  const userId = session!.userId;

  const [totalAgents, activeAgents, recentRuns, projects] = await Promise.all([
    prisma.agent.count({ where: { project: { userId } } }),
    prisma.agent.count({ where: { project: { userId }, isActive: true } }),
    prisma.agentRun.findMany({
      where: { agent: { project: { userId } } },
      orderBy: { startedAt: "desc" },
      take: 6,
      include: { agent: { select: { name: true } } },
    }),
    prisma.project.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 5 }),
  ]);

  const toolExecutions = await prisma.executionLog.count({
    where: { event: "tool_result", run: { agent: { project: { userId } } } },
  });

  const stats = [
    { label: "Total Agents", value: totalAgents, icon: Bot },
    { label: "Active Agents", value: activeAgents, icon: Zap },
    { label: "Tool Executions", value: toolExecutions, icon: Wrench },
    { label: "Agent Runs", value: recentRuns.length ? await prisma.agentRun.count({ where: { agent: { project: { userId } } } }) : 0, icon: Activity },
  ];

  const statusTone: Record<string, "success" | "error" | "warning" | "neutral"> = {
    SUCCESS: "success",
    ERROR: "error",
    RUNNING: "warning",
    WAITING_APPROVAL: "warning",
    PENDING: "neutral",
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-ink-mid mt-1">Overview of your agents and activity</p>
        </div>
        <Link href="/agents" className="px-4 py-2 rounded-xl text-sm font-medium bg-brand-gradient text-white">
          New Agent
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <Card key={s.label} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-ink-faint">{s.label}</span>
              <div className="w-8 h-8 rounded-lg bg-indigo/10 text-indigo flex items-center justify-center">
                <s.icon size={15} />
              </div>
            </div>
            <span className="text-2xl font-semibold tracking-tight">{s.value}</span>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="col-span-2">
          <h2 className="text-sm font-medium mb-4">Recent Projects</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-ink-faint">No projects yet — create one from the Agents page.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {projects.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>{p.name}</span>
                  <span className="text-ink-faint text-xs">{p.description ?? ""}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h2 className="text-sm font-medium mb-4">Getting Started</h2>
          <ol className="text-sm text-ink-mid space-y-2 list-decimal list-inside">
            <li>Add a model provider key in Models</li>
            <li>Create an agent from a template</li>
            <li>Test it in the Playground</li>
            <li>Deploy it as an API endpoint</li>
          </ol>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-medium mb-4">Recent Agent Runs</h2>
        {recentRuns.length === 0 ? (
          <p className="text-sm text-ink-faint">No runs yet. Test an agent from the Playground to see it here.</p>
        ) : (
          <div className="flex flex-col">
            <div className="grid grid-cols-4 text-xs text-ink-faint pb-3 mb-1 border-b border-border">
              <span>Agent</span><span>Status</span><span>Tokens</span><span className="text-right">When</span>
            </div>
            {recentRuns.map((r: any) => (
              <div key={r.id} className="grid grid-cols-4 text-sm py-3 border-b border-border last:border-0">
                <span>{r.agent.name}</span>
                <Badge tone={statusTone[r.status]}>{r.status}</Badge>
                <span className="text-ink-mid">{r.tokensUsed}</span>
                <span className="text-right text-ink-faint flex items-center justify-end gap-1">
                  <Clock size={12} /> {r.startedAt.toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
