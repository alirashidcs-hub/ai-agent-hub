import { describe, it, expect } from "vitest";
import { validateGraph, MAX_NODES } from "@/lib/agent-runner/validate";

const node = (id: string, type = "tool", overrides: Partial<Record<string, unknown>> = {}) => ({
  id, type, label: id, positionX: 0, positionY: 0, config: {}, ...overrides,
});

describe("lib/agent-runner/validate — server-side agent graph validation", () => {
  it("accepts a minimal valid graph", () => {
    const result = validateGraph({
      nodes: [node("s", "start"), node("o", "output")],
      edges: [{ fromNodeId: "s", fromPort: "next", toNodeId: "o" }],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown node type", () => {
    const result = validateGraph({ nodes: [node("x", "not_a_real_type")], edges: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate node ids", () => {
    const result = validateGraph({ nodes: [node("dup"), node("dup")], edges: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/duplicate/i);
  });

  it("rejects an edge referencing a nonexistent node", () => {
    const result = validateGraph({
      nodes: [node("a")],
      edges: [{ fromNodeId: "a", fromPort: "next", toNodeId: "ghost" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/unknown node/i);
  });

  it("rejects more than one Start node", () => {
    const result = validateGraph({ nodes: [node("s1", "start"), node("s2", "start")], edges: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/one start/i);
  });

  it("rejects an invalid provider on an llm node", () => {
    const result = validateGraph({
      nodes: [node("l", "llm", { config: { provider: "not-a-real-provider" } })],
      edges: [],
    });
    expect(result.ok).toBe(false);
  });

  it("enforces the max node count", () => {
    const nodes = Array.from({ length: MAX_NODES + 1 }, (_, i) => node(`n${i}`));
    const result = validateGraph({ nodes, edges: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects an oversized payload", () => {
    const bigConfig = { blob: "x".repeat(600_000) };
    const result = validateGraph({ nodes: [node("a", "tool", { config: bigConfig })], edges: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too large/i);
  });

  it("rejects malformed input entirely (not an object)", () => {
    expect(validateGraph(null).ok).toBe(false);
    expect(validateGraph("not a graph").ok).toBe(false);
    expect(validateGraph(42).ok).toBe(false);
  });
});
