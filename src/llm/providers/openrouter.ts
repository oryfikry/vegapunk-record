import { createLLMError, type LLMProvider, type LLMRequest, type LLMResponse } from "../types";

type ChatCompletionChoice = {
  message?: {
    content?: string;
  };
};

type ChatCompletionResponse = {
  model?: string;
  choices?: ChatCompletionChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

function redact(value: string, key: string | undefined): string {
  if (!key) {
    return value;
  }

  return value.split(key).join("[REDACTED]");
}

async function readError(response: Response, key: string): Promise<string> {
  const body = await response.text().catch(() => "");
  return redact(`HTTP ${response.status} ${response.statusText}${body ? `: ${body}` : ""}`, key);
}

export class OpenRouterProvider implements LLMProvider {
  readonly name = "openrouter";
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: { apiKey?: string; timeoutMs?: number } = {}) {
    this.apiKey = options.apiKey ?? Bun.env.OPENROUTER_API_KEY ?? "";
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.trim().length > 0;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!(await this.isAvailable())) {
      throw createLLMError(this.name, "OPENROUTER_API_KEY is missing", false);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model ?? "openrouter/auto",
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.max_tokens,
        }),
      });

      if (!response.ok) {
        throw createLLMError(this.name, await readError(response, this.apiKey), response.status >= 500 || response.status === 429);
      }

      const data = (await response.json()) as ChatCompletionResponse;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw createLLMError(this.name, "OpenRouter response did not include message content", true);
      }

      return {
        content,
        model: data.model ?? request.model ?? "openrouter/auto",
        provider: this.name,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens ?? 0,
          completion_tokens: data.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      if (typeof error === "object" && error !== null && "provider" in error && "retryable" in error) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw createLLMError(this.name, redact(message, this.apiKey), error instanceof Error && error.name === "AbortError");
    } finally {
      clearTimeout(timeout);
    }
  }
}
