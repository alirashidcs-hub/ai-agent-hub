"use client";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { NODE_DEFS } from "./nodeDefs";

export function CustomNode({ data, selected }: NodeProps) {
  const nodeType = (data as any).type as string;
  const label = (data as any).label as string;
  const def = NODE_DEFS[nodeType];
  if (!def) return null;
  const Icon = def.icon;

  return (
    <div
      className="rounded-node bg-panel-solid border-[1.5px] w-52"
      style={{
        borderColor: selected ? "#6366F1" : "rgba(255,255,255,0.07)",
        boxShadow: selected ? "0 0 0 3px rgba(99,102,241,0.15)" : "0 4px 16px rgba(0,0,0,0.3)",
      }}
    >
      {def.hasInput && (
        <Handle type="target" position={Position.Left} id="in" style={{ width: 12, height: 12, background: "#08080C", border: "2px solid #9797A6" }} />
      )}

      <div className="flex items-center gap-2 px-3 h-10 border-b border-border">
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: `${def.color}22`, color: def.color }}>
          <Icon size={12} />
        </div>
        <span className="text-xs font-medium truncate flex-1 text-ink">{label}</span>
      </div>
      <div className="px-3 py-2 text-xs text-ink-faint">{def.label}</div>

      {def.outputs.map((port, i) => {
        const top = `${(100 / (def.outputs.length + 1)) * (i + 1)}%`;
        return (
          <Handle
            key={port}
            type="source"
            position={Position.Right}
            id={port}
            style={{ top, width: 12, height: 12, background: def.color, border: "2px solid #08080C" }}
          >
            {def.outputs.length > 1 && (
              <span className="absolute right-4 -top-1.5 text-[10px] text-ink-faint whitespace-nowrap pointer-events-none">{port}</span>
            )}
          </Handle>
        );
      })}
    </div>
  );
}
