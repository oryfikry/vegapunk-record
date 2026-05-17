import { Elysia, type Context } from "elysia";
import type { StellaConfig } from "../../config";
import type { Config, VegapunkDatabase } from "../../db";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonError(set: Context["set"], status: 400 | 403 | 404, error: string) {
  set.status = status;
  return { error, status };
}

function serializeConfig(config: Config): Config {
  return config;
}

function configValueToString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function createConfigRoutes(db: VegapunkDatabase, config: StellaConfig) {
  let cachedLlmProvider = config.llmProvider;
  let cachedLlmProviderUpdatedAt: string | undefined;

  const getCachedLlmProvider = () => {
    const stored = db.configs.get("LLM_PROVIDER");

    if (!stored) {
      cachedLlmProvider = config.llmProvider;
      cachedLlmProviderUpdatedAt = undefined;
      return cachedLlmProvider;
    }

    if (stored.updated_at !== cachedLlmProviderUpdatedAt) {
      cachedLlmProvider = stored.value;
      cachedLlmProviderUpdatedAt = stored.updated_at;
    }

    return cachedLlmProvider;
  };

  return new Elysia({ prefix: "/api/config" })
    .get("/", () => ({
      service: "stella" as const,
      llmProvider: getCachedLlmProvider(),
    }))
    .patch("/", ({ body, set }) => {
      if (!isRecord(body)) {
        return jsonError(set, 400, "Request body must be a JSON object");
      }

      const updated: Config[] = [];

      for (const [key, value] of Object.entries(body)) {
        const existing = db.configs.get(key);

        if (!existing) {
          return jsonError(set, 404, `Config not found: ${key}`);
        }

        if (existing.is_secret !== 0) {
          return jsonError(set, 403, `Config key is secret and cannot be updated: ${key}`);
        }

        const updatedConfig = db.configs.set({
          key,
          value: configValueToString(value),
          type: existing.type,
          is_secret: false,
        });

        if (key === "LLM_PROVIDER") {
          cachedLlmProvider = updatedConfig.value;
          cachedLlmProviderUpdatedAt = updatedConfig.updated_at;
        }

        updated.push(updatedConfig);
      }

      return { ok: true, config: updated.map(serializeConfig) };
    });
}
