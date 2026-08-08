import {
  Play, Cpu, Bot, Wrench, Plug, Search, Globe, Code2,
  GitBranch, Route, Database, UserCheck, LogOut as OutputIcon,
} from "lucide-react";

export interface NodeDef {
  type: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  hasInput: boolean;
  outputs: string[];
}

export const NODE_DEFS: Record<string, NodeDef> = {
  start:     { type: "start",     label: "Start",          icon: Play,       color: "#2DD4A0", hasInput: false, outputs: ["next"] },
  llm:       { type: "llm",       label: "LLM",             icon: Cpu,        color: "#6366F1", hasInput: true,  outputs: ["next"] },
  agent:     { type: "agent",     label: "Agent",           icon: Bot,        color: "#A855F7", hasInput: true,  outputs: ["next"] },
  tool:      { type: "tool",      label: "Tool",            icon: Wrench,     color: "#F5A623", hasInput: true,  outputs: ["next"] },
  mcp:       { type: "mcp",       label: "MCP Tool",        icon: Plug,       color: "#22D3EE", hasInput: true,  outputs: ["next"] },
  websearch: { type: "websearch", label: "Web Search",      icon: Search,     color: "#22D3EE", hasInput: true,  outputs: ["next"] },
  http:      { type: "http",      label: "HTTP Request",    icon: Globe,      color: "#F5A623", hasInput: true,  outputs: ["next"] },
  code:      { type: "code",      label: "Code",            icon: Code2,      color: "#9797A6", hasInput: true,  outputs: ["next"] },
  condition: { type: "condition", label: "Condition",       icon: GitBranch,  color: "#EAB308", hasInput: true,  outputs: ["true", "false"] },
  router:    { type: "router",    label: "Router",          icon: Route,      color: "#EAB308", hasInput: true,  outputs: ["a", "b"] },
  memory:    { type: "memory",    label: "Memory",          icon: Database,   color: "#A855F7", hasInput: true,  outputs: ["next"] },
  database:  { type: "database",  label: "Database",        icon: Database,   color: "#6366F1", hasInput: true,  outputs: ["next"] },
  approval:  { type: "approval",  label: "Human Approval",  icon: UserCheck,  color: "#F2555A", hasInput: true,  outputs: ["approved", "rejected"] },
  output:    { type: "output",    label: "Output",          icon: OutputIcon, color: "#2DD4A0", hasInput: true,  outputs: [] },
};

export const PALETTE_ORDER = [
  "start", "llm", "agent", "tool", "mcp", "websearch", "http",
  "code", "condition", "router", "memory", "database", "approval", "output",
];
