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

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

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

export class CustomProvider implements LLMProvider {
  readonly name = "custom";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: { apiKey?: string; baseUrl?: string; model?: string; timeoutMs?: number } = {}) {
    this.apiKey = options.apiKey ?? Bun.env.CUSTOM_LLM_API_KEY ?? "";
    this.baseUrl = trimTrailingSlash(options.baseUrl ?? Bun.env.CUSTOM_LLM_BASE_URL ?? "");
    this.model = options.model ?? Bun.env.CUSTOM_LLM_MODEL ?? "custom/default";
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.trim().length > 0 && this.baseUrl.trim().length > 0;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!this.baseUrl.trim()) {
      throw createLLMError(this.name, "CUSTOM_LLM_BASE_URL is missing", false);
    }

    if (!this.apiKey.trim()) {
      throw createLLMError(this.name, "CUSTOM_LLM_API_KEY is missing", false);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: request.model ?? this.model,
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
        throw createLLMError(this.name, "Custom LLM response did not include message content", true);
      }

      return {
        content,
        model: data.model ?? request.model ?? this.model,
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
