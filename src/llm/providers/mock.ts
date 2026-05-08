import type { LLMProvider, LLMRequest, LLMResponse } from "../types";

const MOCK_USAGE = {
  prompt_tokens: 12,
  completion_tokens: 24,
};

function stableHash(input: string): string {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function serializeRequest(request: LLMRequest): string {
  return JSON.stringify({
    model: request.model ?? "mock-model",
    messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
    temperature: request.temperature ?? null,
    max_tokens: request.max_tokens ?? null,
  });
}

export class MockProvider implements LLMProvider {
  readonly name = "mock";

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const hash = stableHash(serializeRequest(request));
    const lastMessage = request.messages.at(-1)?.content ?? "";
    const preview = lastMessage.trim().slice(0, 48) || "empty prompt";

    return {
      content: `mock:${hash}:${preview}`,
      model: request.model ?? "mock-model",
      provider: this.name,
      usage: { ...MOCK_USAGE },
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
