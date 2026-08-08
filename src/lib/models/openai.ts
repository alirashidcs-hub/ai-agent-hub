import type { ModelAdapter, ModelCallParams, StreamChunk } from "./types";

/**
 * Adapter for OpenAI's Chat Completions API (streaming).
 */
export const openaiAdapter: ModelAdapter = {
  async *streamChat(params: ModelCallParams): AsyncGenerator<StreamChunk> {
    const { apiKey, model, messages, systemPrompt, temperature = 0.7, maxTokens = 1024 } = params;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => res.statusText);
      yield { type: "error", error: `OpenAI API error (${res.status}): ${text}` };
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
        if (data === "[DONE]") continue;
        if (!data) continue;
        try {
          const event = JSON.parse(data);
          const delta = event.choices?.[0]?.delta?.content;
          if (delta) {
            yield { type: "token", text: delta };
          }
          // The final SSE chunk (when stream_options.include_usage is set)
          // carries real provider-reported token counts — prefer this over
          // estimating from the number of streamed chunks.
          if (event.usage) {
            inputTokens = event.usage.prompt_tokens ?? inputTokens;
            outputTokens = event.usage.completion_tokens ?? outputTokens;
          }
        } catch {
          // ignore malformed SSE fragments
        }
      }
    }

    yield { type: "done", usage: { inputTokens, outputTokens } };
  },
};
