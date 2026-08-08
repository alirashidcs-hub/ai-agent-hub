"use client";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  Connection, Edge, Node, ReactFlowProvider, BackgroundVariant,
} from "@xyflow/react";
import { CustomNode } from "@/components/builder/CustomNode";
import { ConfigPanel, EditableNode } from "@/components/builder/ConfigPanel";
import { NODE_DEFS, PALETTE_ORDER } from "@/components/builder/nodeDefs";
import { Button } from "@/components/ui/button";
import { Play, Save, Loader2 } from "lucide-react";

const nodeTypes = { custom: CustomNode };

function BuilderInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [agentName, setAgentName] = useState("");

  useEffect(() => {
    fetch(`/api/agents/${id}`)
      .then((r) => r.json())
      .then((agent) => {
        setAgentName(agent.name);
        setNodes(
          agent.nodes.map((n: any) => ({
            id: n.id,
            type: "custom",
            position: { x: n.positionX, y: n.positionY },
            data: { type: n.type, label: n.label, config: n.config },
          }))
        );
        setEdges(
          agent.edges.map((e: any) => ({
            id: `${e.fromNodeId}-${e.fromPort}-${e.toNodeId}`,
            source: e.fromNodeId,
            sourceHandle: e.fromPort,
            target: e.toNodeId,
            targetHandle: "in",
            style: { stroke: "#6366F1", strokeWidth: 2 },
          }))
        );
        setLoading(false);
      });
  }, [id, setNodes, setEdges]);

  const onConnect = useCallback(
    (conn: Connection) => setEdges((eds) => addEdge({ ...conn, style: { stroke: "#A855F7", strokeWidth: 2 } }, eds)),
    [setEdges]
  );

  const addNode = (type: string) => {
    const def = NODE_DEFS[type];
    const newId = crypto.randomUUID();
    setNodes((ns) => [
      ...ns,
      {
        id: newId,
        type: "custom",
        position: { x: 300 + Math.random() * 200, y: 150 + Math.random() * 200 },
        data: { type, label: def.label, config: {} },
      },
    ]);
  };

  const deleteNode = (nodeId: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== nodeId));
    setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedId(null);
  };

  const selectedNode = nodes.find((n) => n.id === selectedId);
  const editable: EditableNode | null = selectedNode
    ? { id: selectedNode.id, type: (selectedNode.data as any).type, label: (selectedNode.data as any).label, config: (selectedNode.data as any).config ?? {} }
    : null;

  function updateNodeData(updated: EditableNode) {
    setNodes((ns) => ns.map((n) => (n.id === updated.id ? { ...n, data: { ...n.data, label: updated.label, config: updated.config } } : n)));
  }

  async function save() {
    setSaving(true);
    await fetch(`/api/agents/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nodes: nodes.map((n) => ({
          id: n.id,
          type: (n.data as any).type,
          label: (n.data as any).label,
          positionX: n.position.x,
          positionY: n.position.y,
          config: (n.data as any).config ?? {},
        })),
        edges: edges.map((e) => ({ fromNodeId: e.source, fromPort: e.sourceHandle ?? "next", toNodeId: e.target })),
      }),
    });
    setSaving(false);
  }

  if (loading) {
    return <div className="h-screen flex items-center justify-center text-ink-faint"><Loader2 className="animate-spin" size={20} /></div>;
  }

  return (
    <div className="flex h-screen">
      <div className="w-52 shrink-0 p-3 glass rounded-none border-y-0 border-l-0 overflow-y-auto">
        <p className="text-xs uppercase tracking-wide text-ink-faint px-1 mb-2">Add Node</p>
        <div className="flex flex-col gap-1">
          {PALETTE_ORDER.map((t) => {
            const def = NODE_DEFS[t];
            const Icon = def.icon;
            return (
              <button key={t} onClick={() => addNode(t)} className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs text-ink-mid hover:bg-white/5 hover:text-ink">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${def.color}22`, color: def.color }}>
                  <Icon size={12} />
                </div>
                {def.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 relative">
        <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-5 z-10 border-b border-border bg-bg/70 backdrop-blur">
          <span className="text-sm font-medium">{agentName}</span>
          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : (<><Save size={14} /> Save</>)}</Button>
            <Button variant="primary" onClick={() => router.push(`/playground?agent=${id}`)}><Play size={14} /> Test Agent</Button>
          </div>
        </div>

        <div className="pt-14 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            colorMode="dark"
          >
            <Background variant={BackgroundVariant.Dots} gap={22} color="rgba(255,255,255,0.06)" />
            <Controls />
            <MiniMap pannable zoomable style={{ background: "#111118" }} maskColor="rgba(8,8,12,0.6)" />
          </ReactFlow>
        </div>
      </div>

      {editable && (
        <div className="p-3">
          <ConfigPanel node={editable} onChange={updateNodeData} onClose={() => setSelectedId(null)} onDelete={deleteNode} />
        </div>
      )}
    </div>
  );
}

export default function BuilderPage() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  );
}
