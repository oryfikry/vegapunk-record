import { Elysia, type Context } from "elysia";
import type { ChromaGateway } from "../../chroma";
import type { VegapunkDatabase } from "../../db";
import { search } from "../../search";

function jsonError(set: Context["set"], status: 400, error: string) {
  set.status = status;
  return { error, status };
}

function parseLimit(value: unknown): number {
  if (typeof value !== "string") {
    return 10;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 10;
  }

  return Math.min(parsed, 100);
}

export type KnowledgeRoutesOptions = {
  chromaClient?: ChromaGateway;
};

export function createKnowledgeRoutes(db: VegapunkDatabase, options: KnowledgeRoutesOptions = {}) {
  return new Elysia({ prefix: "/api/knowledge" })
    .get("/search", async ({ query, set }) => {
      if (typeof query.q !== "string" || query.q.trim().length === 0) {
        return jsonError(set, 400, "q must be a non-empty search query");
      }

      const limit = parseLimit(query.limit);

      if (options.chromaClient) {
        return search(db, query.q, { chromaClient: options.chromaClient, limit });
      }

      return search(db, query.q, { limit });
    });
}
