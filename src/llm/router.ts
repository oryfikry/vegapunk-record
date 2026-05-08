import { GeminiProvider, MockProvider, OllamaProvider, OpenAIProvider, OpenRouterProvider } from "./providers";
import { createLLMError, type LLMProvider, type LLMProviderName, type LLMRequest, type LLMResponse } from "./types";

export type LLMRouterConfig = {
  provider?: LLMProviderName;
  providers?: LLMProvider[];
  fallbackProvider?: LLMProviderName;
};

function isProviderName(value: string | undefined): value is LLMProviderName {
  return value === "mock" || value === "openrouter" || value === "openai" || value === "gemini" || value === "ollama";
}

function configuredProvider(value: LLMProviderName | undefined): LLMProviderName {
  if (value) {
    return value;
  }

  const envProvider = Bun.env.LLM_PROVIDER;
  return isProviderName(envProvider) ? envProvider : "mock";
}

export function createDefaultProviders(): LLMProvider[] {
  return [new MockProvider(), new OpenRouterProvider(), new OpenAIProvider(), new GeminiProvider(), new OllamaProvider()];
}

export class LLMRouter {
  private readonly providerName: LLMProviderName;
  private readonly providers: Map<string, LLMProvider>;
  private readonly fallbackProviderName: LLMProviderName | undefined;

  constructor(config: LLMRouterConfig = {}) {
    this.providerName = configuredProvider(config.provider);
    this.providers = new Map((config.providers ?? createDefaultProviders()).map((provider) => [provider.name, provider]));
    this.fallbackProviderName = config.fallbackProvider;
  }

  getProvider(name: LLMProviderName): LLMProvider | undefined {
    return this.providers.get(name);
  }

  async route(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.providers.get(this.providerName);

    if (!provider) {
      throw createLLMError(this.providerName, `LLM provider '${this.providerName}' is not registered`, false);
    }

    if (await provider.isAvailable()) {
      return provider.complete(request);
    }

    if (this.fallbackProviderName) {
      const fallbackProvider = this.providers.get(this.fallbackProviderName);

      if (fallbackProvider && (await fallbackProvider.isAvailable())) {
        return fallbackProvider.complete(request);
      }
    }

    throw createLLMError(provider.name, `LLM provider '${provider.name}' is unavailable`, false);
  }
}
