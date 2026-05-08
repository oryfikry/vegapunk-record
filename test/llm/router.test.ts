import { describe, expect, test } from "bun:test";
import { GeminiProvider, LLMRouter, MockProvider, OllamaProvider, OpenAIProvider, OpenRouterProvider } from "../../src/llm";
import type { LLMProvider } from "../../src/llm";

function unavailableProvider(name: "openai" | "openrouter" | "gemini"): LLMProvider {
  return {
    name,
    async complete() {
      throw new Error("unavailable test provider should not complete");
    },
    async isAvailable() {
      return false;
    },
  };
}

describe("LLMRouter", () => {
  test("routes requests to configured mock provider", async () => {
    const router = new LLMRouter({ provider: "mock", providers: [new MockProvider()] });

    const response = await router.route({ messages: [{ role: "user", content: "hello router" }] });

    expect(response.provider).toBe("mock");
    expect(response.content).toContain("hello router");
    expect(router.getProvider("mock")?.name).toBe("mock");
  });

  test("does not silently fall back when configured provider is unavailable", async () => {
    const router = new LLMRouter({
      provider: "openai",
      providers: [unavailableProvider("openai"), new MockProvider()],
    });

    await expect(router.route({ messages: [{ role: "user", content: "no fallback" }] })).rejects.toEqual({
      provider: "openai",
      error: "LLM provider 'openai' is unavailable",
      retryable: false,
    });
  });

  test("uses explicit fallback provider when configured", async () => {
    const router = new LLMRouter({
      provider: "openrouter",
      fallbackProvider: "mock",
      providers: [unavailableProvider("openrouter"), new MockProvider()],
    });

    const response = await router.route({ messages: [{ role: "user", content: "fallback allowed" }] });

    expect(response.provider).toBe("mock");
    expect(response.content).toContain("fallback allowed");
  });

  test("remote providers report unavailable and throw non-retryable errors when keys are missing", async () => {
    const providers = [
      new OpenRouterProvider({ apiKey: "" }),
      new OpenAIProvider({ apiKey: "" }),
      new GeminiProvider({ apiKey: "" }),
    ];

    for (const provider of providers) {
      expect(await provider.isAvailable()).toBe(false);
      await expect(provider.complete({ messages: [{ role: "user", content: "must not call network" }] })).rejects.toMatchObject({
        provider: provider.name,
        retryable: false,
      });
    }
  });

  test("Ollama reports unavailable when local server is unreachable", async () => {
    const provider = new OllamaProvider({ baseUrl: "http://127.0.0.1:1", readinessTimeoutMs: 50 });

    expect(await provider.isAvailable()).toBe(false);
  });
});
