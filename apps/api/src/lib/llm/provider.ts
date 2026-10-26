export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ChatCompletionChoice {
  message: ChatMessage & { toolCalls?: Array<{ id: string; name: string; arguments: string }> };
  finishReason: string | null;
}

export interface ChatCompletionResponse {
  choices: ChatCompletionChoice[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LlmProvider {
  readonly name: string;
  chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
}
