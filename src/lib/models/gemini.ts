import type { ModelAdapter, ModelCallParams, StreamChunk } from "./types";

/**
 * Adapter for Google's Gemini generateContent streaming API.
 */
export const geminiAdapter: ModelAdapter = {
  async *streamChat(params: ModelCallParams): AsyncGenerator<StreamChunk> {
    const { apiKey, model, messages, systemPrompt, temperature = 0.7, maxTokens = 1024 } = params;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
        contents: messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
      }),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => res.statusText);
      yield { type: "error", error: `Gemini API error (${res.status}): ${text}` };
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
          const text = event.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            yield { type: "token", text };
          }
          // Gemini reports cumulative usageMetadata on stream chunks —
          // the last one seen holds the final real token counts.
          if (event.usageMetadata) {
            inputTokens = event.usageMetadata.promptTokenCount ?? inputTokens;
            outputTokens = event.usageMetadata.candidatesTokenCount ?? outputTokens;
          }
        } catch {
          // ignore malformed SSE fragments
        }
      }
    }

    yield { type: "done", usage: { inputTokens, outputTokens } };
  },
};
