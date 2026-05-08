export type LLMMessage = {
  role: string;
  content: string;
};

export interface LLMRequest {
  model?: string;
  messages: LLMMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export interface LLMError {
  provider: string;
  error: string;
  retryable: boolean;
}

export interface LLMProvider {
  name: string;
  complete(request: LLMRequest): Promise<LLMResponse>;
  isAvailable(): Promise<boolean>;
}

export type LLMProviderName = "mock" | "openrouter" | "openai" | "gemini" | "ollama" | "cliproxy";

export function createLLMError(provider: string, error: string, retryable: boolean): LLMError {
  return { provider, error, retryable };
}
