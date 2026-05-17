import { Elysia, type Context } from "elysia";
import type { VegapunkDatabase } from "../../db";
import { requireAuthToken } from "../auth-guard";

type JsonRecord = Record<string, unknown>;

const supportedProviders = ["openai", "openrouter", "gemini", "ollama", "custom"] as const;
type SetupProvider = (typeof supportedProviders)[number];

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSupportedProvider(value: string): value is SetupProvider {
  return (supportedProviders as readonly string[]).includes(value);
}

function jsonError(set: Context["set"], status: 400 | 404, error: string) {
  set.status = status;
  return { error, status };
}

const providerKeyMap: Record<SetupProvider, string> = {
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  gemini: "GEMINI_API_KEY",
  ollama: "OLLAMA_BASE_URL",
  custom: "CUSTOM_LLM_API_KEY",
};

export function createSetupRoutes(db: VegapunkDatabase) {
  return new Elysia({ prefix: "/api/setup" })
    .get("/providers", () => ({
      providers: supportedProviders.map((name) => ({
        name,
        keyField: providerKeyMap[name],
        requiresKey: name !== "ollama",
      })),
    }))
    .post("/provider", ({ body, request, set }) => {
      const authError = requireAuthToken(request, set);
      if (authError) {
        return authError;
      }

      if (!isRecord(body)) {
        return jsonError(set, 400, "Request body must be a JSON object");
      }

      if (typeof body.provider !== "string" || !isSupportedProvider(body.provider)) {
        return jsonError(set, 400, `provider must be one of: ${supportedProviders.join(", ")}`);
      }

      const provider = body.provider;
      const requiresKey = provider !== "ollama";

      if (requiresKey) {
        if (typeof body.apiKey !== "string" || body.apiKey.trim().length === 0) {
          return jsonError(set, 400, "apiKey must be a non-empty string for this provider");
        }
      }

      db.configs.set({
        key: "LLM_PROVIDER",
        value: provider,
        type: "string",
        is_secret: false,
      });

      const keyField = providerKeyMap[provider];

      if (requiresKey && typeof body.apiKey === "string") {
        db.configs.set({
          key: keyField,
          value: body.apiKey.trim(),
          type: "string",
          is_secret: true,
        });
      }

      if (provider === "ollama" && typeof body.baseUrl === "string" && body.baseUrl.trim().length > 0) {
        db.configs.set({
          key: "OLLAMA_BASE_URL",
          value: body.baseUrl.trim(),
          type: "string",
          is_secret: false,
        });
      }

      if (provider === "custom") {
        if (typeof body.baseUrl === "string" && body.baseUrl.trim().length > 0) {
          db.configs.set({
            key: "CUSTOM_LLM_BASE_URL",
            value: body.baseUrl.trim(),
            type: "string",
            is_secret: false,
          });
        }

        if (typeof body.model === "string" && body.model.trim().length > 0) {
          db.configs.set({
            key: "CUSTOM_LLM_MODEL",
            value: body.model.trim(),
            type: "string",
            is_secret: false,
          });
        }
      }

      return { ok: true, provider, configured: true };
    });
}
