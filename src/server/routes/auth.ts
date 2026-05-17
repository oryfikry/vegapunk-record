import { Elysia, type Context } from "elysia";
import type { StellaConfig } from "../../config";
import type { VegapunkDatabase } from "../../db";
import { configuredAuthToken } from "../auth-guard";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonError(set: Context["set"], status: 400 | 401 | 403 | 500, error: string) {
  set.status = status;
  return { error, status };
}

export function createAuthRoutes(db: VegapunkDatabase, config: StellaConfig) {
  return new Elysia({ prefix: "/api/auth" })
    .get("/status", () => {
      const token = configuredAuthToken();
      const hasAuthToken = token !== null && token.length > 0;

      const provider = db.configs.get("LLM_PROVIDER")?.value ?? config.llmProvider;
      const isSetup = provider !== "mock";

      return {
        requiresAuthToken: hasAuthToken,
        isSetup,
      };
    })
    .post("/verify", ({ body, set }) => {
      if (!isRecord(body)) {
        return jsonError(set, 400, "Request body must be a JSON object");
      }

      const token = configuredAuthToken();

      if (!token || token.length === 0) {
        return { verified: true };
      }

      const supplied = body.authToken;
      if (typeof supplied !== "string" || supplied.length === 0) {
        return jsonError(set, 400, "authToken must be a non-empty string");
      }

      if (supplied !== token) {
        return jsonError(set, 401, "Invalid auth token");
      }

      return { verified: true };
    });
}
