import type { ModelAdapter, ModelCallParams, StreamChunk } from "./types";

/**
 * Adapter for the Anthropic Messages API (streaming).
 * https://docs.claude.com/en/api/messages-streaming
 */
export const anthropicAdapter: ModelAdapter = {
  async *streamChat(params: ModelCallParams): AsyncGenerator<StreamChunk> {
    const { apiKey, model, messages, systemPrompt, temperature = 0.7, maxTokens = 1024 } = params;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        max_tokens: maxTokens,
        temperature,
        stream: true,
        messages: messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => res.statusText);
      yield { type: "error", error: `Anthropic API error (${res.status}): ${text}` };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let inputTokens = 0;
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data) continue;
        try {
          const event = JSON.parse(data);
          if (event.type === "content_block_delta" && event.delta?.text) {
            yield { type: "token", text: event.delta.text };
          }
          if (event.type === "message_start") {
            inputTokens = event.message?.usage?.input_tokens ?? 0;
          }
          if (event.type === "message_delta") {
            outputTokens = event.usage?.output_tokens ?? outputTokens;
          }
        } catch {
          // ignore malformed SSE fragments
        }
      }
    }

    yield { type: "done", usage: { inputTokens, outputTokens } };
  },
};
