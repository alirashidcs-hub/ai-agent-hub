export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface StreamChunk {
  type: "token" | "done" | "error";
  text?: string;
  usage?: { inputTokens: number; outputTokens: number };
  error?: string;
}

export interface ModelCallParams {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ModelAdapter {
  streamChat(params: ModelCallParams): AsyncGenerator<StreamChunk>;
}
