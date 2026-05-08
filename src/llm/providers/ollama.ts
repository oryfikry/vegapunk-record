import { createLLMError, type LLMProvider, type LLMRequest, type LLMResponse } from "../types";

type OllamaResponse = {
  model?: string;
  message?: {
    content?: string;
  };
  prompt_eval_count?: number;
  eval_count?: number;
};

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";
  private readonly baseUrl: string;
  private readonly readinessTimeoutMs: number;
  private readonly timeoutMs: number;

  constructor(options: { baseUrl?: string; readinessTimeoutMs?: number; timeoutMs?: number } = {}) {
    this.baseUrl = trimTrailingSlash(options.baseUrl ?? Bun.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434");
    this.readinessTimeoutMs = options.readinessTimeoutMs ?? 5_000;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async isAvailable(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.readinessTimeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, { method: "GET", signal: controller.signal });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model ?? "llama3.2",
          messages: request.messages,
          stream: false,
          options: {
            temperature: request.temperature,
            num_predict: request.max_tokens,
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw createLLMError(this.name, `HTTP ${response.status} ${response.statusText}${body ? `: ${body}` : ""}`, response.status >= 500 || response.status === 429);
      }

      const data = (await response.json()) as OllamaResponse;
      const content = data.message?.content;

      if (!content) {
        throw createLLMError(this.name, "Ollama response did not include message content", true);
      }

      return {
        content,
        model: data.model ?? request.model ?? "llama3.2",
        provider: this.name,
        usage: {
          prompt_tokens: data.prompt_eval_count ?? 0,
          completion_tokens: data.eval_count ?? 0,
        },
      };
    } catch (error) {
      if (typeof error === "object" && error !== null && "provider" in error && "retryable" in error) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw createLLMError(this.name, message, true);
    } finally {
      clearTimeout(timeout);
    }
  }
}
