import { Elysia, type Context } from "elysia";
import type { StellaConfig } from "../../config";
import type { VegapunkDatabase } from "../../db";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonError(set: Context["set"], status: 400 | 401 | 403 | 500, error: string) {
  set.status = status;
  return { error, status };
}

function getPasscode(): string | null {
  return Bun.env.STELLA_PASSCODE ?? null;
}

export function createAuthRoutes(db: VegapunkDatabase, config: StellaConfig) {
  return new Elysia({ prefix: "/api/auth" })
    .get("/status", () => {
      const passcode = getPasscode();
      const hasPasscode = passcode !== null && passcode.length > 0;

      const provider = db.configs.get("LLM_PROVIDER")?.value ?? config.llmProvider;
      const isSetup = provider !== "mock";

      return {
        requiresPasscode: hasPasscode,
        isSetup,
      };
    })
    .post("/verify", ({ body, set }) => {
      if (!isRecord(body)) {
        return jsonError(set, 400, "Request body must be a JSON object");
      }

      const passcode = getPasscode();

      if (!passcode || passcode.length === 0) {
        return { verified: true };
      }

      if (typeof body.passcode !== "string" || body.passcode.length === 0) {
        return jsonError(set, 400, "passcode must be a non-empty string");
      }

      if (body.passcode !== passcode) {
        return jsonError(set, 401, "Invalid passcode");
      }

      return { verified: true };
    });
}
