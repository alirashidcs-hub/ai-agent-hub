import { describe, it, expect } from "vitest";
import { runAgent, MAX_EXECUTION_STEPS, type RunnerEvent } from "@/lib/agent-runner/engine";

async function collect(gen: AsyncGenerator<RunnerEvent>): Promise<RunnerEvent[]> {
  const events: RunnerEvent[] = [];
  for await (const e of gen) events.push(e);
  return events;
}

const noProvider = async () => null;

describe("lib/agent-runner/engine — execution guards (real shipped engine, no mocks)", () => {
  it("runs a simple tool -> output graph to completion", async () => {
    const events = await collect(
      runAgent({
        nodes: [
          { id: "start", type: "start", label: "Start", config: {} },
          { id: "calc", type: "tool", label: "Calc", config: { toolKey: "calculator", input: { expression: "2+2" } } },
          { id: "out", type: "output", label: "Output", config: {} },
        ],
        edges: [
          { fromNodeId: "start", fromPort: "next", toNodeId: "calc" },
          { fromNodeId: "calc", fromPort: "next", toNodeId: "out" },
        ],
        input: "go",
        resolveProvider: noProvider,
      })
    );
    const toolResult = events.find((e) => e.type === "tool_result");
    expect(toolResult && (toolResult as any).output).toEqual({ result: 4 });
    expect(events.some((e) => e.type === "run_complete")).toBe(true);
    expect(events.some((e) => e.type === "error")).toBe(false);
  });

  it("stops with a clear MAX_STEPS_EXCEEDED error on a routing loop, and never emits run_complete", async () => {
    // router node whose only edge points back to itself — infinite loop if unguarded.
    const events = await collect(
      runAgent({
        nodes: [
          { id: "start", type: "start", label: "Start", config: {} },
          { id: "loop", type: "router", label: "Loop", config: { selectPort: "a" } },
        ],
        edges: [
          { fromNodeId: "start", fromPort: "next", toNodeId: "loop" },
          { fromNodeId: "loop", fromPort: "a", toNodeId: "loop" },
        ],
        input: "go",
        resolveProvider: noProvider,
      })
    );
    const errorEvent = events.find((e) => e.type === "error") as Extract<RunnerEvent, { type: "error" }> | undefined;
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.code).toBe("MAX_STEPS_EXCEEDED");
    expect(errorEvent?.message).toMatch(new RegExp(String(MAX_EXECUTION_STEPS)));
    expect(events.some((e) => e.type === "run_complete")).toBe(false);
    // exactly MAX_EXECUTION_STEPS node_start events before it bails
    expect(events.filter((e) => e.type === "node_start").length).toBe(MAX_EXECUTION_STEPS);
  });

  it("aborts promptly when the client disconnects (AbortSignal)", async () => {
    const controller = new AbortController();
    controller.abort(); // already aborted before the run starts

    const events = await collect(
      runAgent({
        nodes: [
          { id: "start", type: "start", label: "Start", config: {} },
          { id: "calc", type: "tool", label: "Calc", config: { toolKey: "calculator", input: { expression: "1+1" } } },
        ],
        edges: [{ fromNodeId: "start", fromPort: "next", toNodeId: "calc" }],
        input: "go",
        resolveProvider: noProvider,
        signal: controller.signal,
      })
    );
    const errorEvent = events.find((e) => e.type === "error") as Extract<RunnerEvent, { type: "error" }> | undefined;
    expect(errorEvent?.code).toBe("ABORTED");
  });

  it("fails closed with a clear error when Code Execution is used (disabled by design)", async () => {
    const events = await collect(
      runAgent({
        nodes: [
          { id: "start", type: "start", label: "Start", config: {} },
          { id: "code", type: "code", label: "Code", config: {} },
        ],
        edges: [{ fromNodeId: "start", fromPort: "next", toNodeId: "code" }],
        input: "go",
        resolveProvider: noProvider,
      })
    );
    const errorEvent = events.find((e) => e.type === "error") as Extract<RunnerEvent, { type: "error" }> | undefined;
    expect(errorEvent?.message).toMatch(/disabled/i);
  });

  it("evaluates a Condition node and routes true/false without using eval() on raw input", async () => {
    const events = await collect(
      runAgent({
        nodes: [
          { id: "start", type: "start", label: "Start", config: {} },
          { id: "cond", type: "condition", label: "Cond", config: { expression: 'variables.input == "go"' } },
          { id: "yes", type: "output", label: "Yes", config: {} },
          { id: "no", type: "output", label: "No", config: {} },
        ],
        edges: [
          { fromNodeId: "start", fromPort: "next", toNodeId: "cond" },
          { fromNodeId: "cond", fromPort: "true", toNodeId: "yes" },
          { fromNodeId: "cond", fromPort: "false", toNodeId: "no" },
        ],
        input: "go",
        resolveProvider: noProvider,
      })
    );
    const complete = events.find((e) => e.type === "run_complete");
    expect(complete).toBeDefined();
    const nodeStarts = events.filter((e) => e.type === "node_start").map((e: any) => e.nodeId);
    expect(nodeStarts).toContain("yes");
    expect(nodeStarts).not.toContain("no");
  });

  it("regression: string literal content is not mistaken for a variable reference", async () => {
    // Previously, a naive regex substituted ANY identifier-looking text —
    // including letters *inside* a quoted string literal — with a resolved
    // variable value, silently corrupting expressions like `== "go"` into
    // `== "null"`. This graph fails (routes to "no") if that regression
    // reappears.
    const events = await collect(
      runAgent({
        nodes: [
          { id: "start", type: "start", label: "Start", config: {} },
          { id: "cond", type: "condition", label: "Cond", config: { expression: 'variables.input == "hello world"' } },
          { id: "yes", type: "output", label: "Yes", config: {} },
          { id: "no", type: "output", label: "No", config: {} },
        ],
        edges: [
          { fromNodeId: "start", fromPort: "next", toNodeId: "cond" },
          { fromNodeId: "cond", fromPort: "true", toNodeId: "yes" },
          { fromNodeId: "cond", fromPort: "false", toNodeId: "no" },
        ],
        input: "hello world",
        resolveProvider: noProvider,
      })
    );
    const nodeStarts = events.filter((e) => e.type === "node_start").map((e: any) => e.nodeId);
    expect(nodeStarts).toContain("yes");
    expect(nodeStarts).not.toContain("no");
  });
});
