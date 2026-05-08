import { createLLMError, type LLMProvider, type LLMRequest, type LLMResponse } from "../types";

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
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

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(options: { apiKey?: string; timeoutMs?: number } = {}) {
    this.apiKey = options.apiKey ?? Bun.env.GEMINI_API_KEY ?? "";
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey.trim().length > 0;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    if (!(await this.isAvailable())) {
      throw createLLMError(this.name, "GEMINI_API_KEY is missing", false);
    }

    const model = request.model ?? "gemini-1.5-flash";
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: request.messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            temperature: request.temperature,
            maxOutputTokens: request.max_tokens,
          },
        }),
      });

      if (!response.ok) {
        throw createLLMError(this.name, await readError(response, this.apiKey), response.status >= 500 || response.status === 429);
      }

      const data = (await response.json()) as GeminiResponse;
      const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();

      if (!content) {
        throw createLLMError(this.name, "Gemini response did not include message content", true);
      }

      return {
        content,
        model,
        provider: this.name,
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount ?? 0,
          completion_tokens: data.usageMetadata?.candidatesTokenCount ?? 0,
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
