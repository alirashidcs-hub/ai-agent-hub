import { anthropicAdapter } from "./anthropic";
import { openaiAdapter } from "./openai";
import { geminiAdapter } from "./gemini";
import type { ModelAdapter } from "./types";

export * from "./types";

export const MODEL_PROVIDERS = ["openai", "anthropic", "gemini"] as const;
export type ModelProviderKey = (typeof MODEL_PROVIDERS)[number];

// Verified against each provider's current model lineup as of this pass.
// Re-check periodically — providers deprecate/retire model IDs on their own
// schedule (e.g. https://ai.google.dev/gemini-api/docs/changelog,
// https://platform.openai.com/docs/deprecations).
export const DEFAULT_MODELS: Record<ModelProviderKey, string[]> = {
  anthropic: ["claude-sonnet-5", "claude-opus-4-8", "claude-haiku-4-5-20251001"],
  openai: ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-4o"],
  gemini: ["gemini-3.6-flash", "gemini-3.1-pro", "gemini-3.5-flash-lite"],
};

const adapters: Record<ModelProviderKey, ModelAdapter> = {
  anthropic: anthropicAdapter,
  openai: openaiAdapter,
  gemini: geminiAdapter,
};

export function getModelAdapter(provider: ModelProviderKey): ModelAdapter {
  const adapter = adapters[provider];
  if (!adapter) throw new Error(`Unknown model provider: ${provider}`);
  return adapter;
}
