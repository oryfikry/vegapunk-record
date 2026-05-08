import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";
import type { ChromaGateway } from "../../chroma";
import type { VegapunkDatabase } from "../../db";
import { search, type SearchResult, type SearchResponse } from "../../search";

const collections = ["activity_logs", "core_knowledge", "ephemeral_memory"] as const;

export const queryRecordsInputSchema = {
  query: z.string().trim().min(1),
  collection: z.enum(collections).optional(),
  limit: z.number().int().min(1).max(100).optional(),
};

const queryResultSchema = z.object({
  id: z.string(),
  collection: z.enum(collections),
  title: z.string(),
  content: z.string(),
  timestamp: z.string(),
  metadata: z.record(z.string(), z.unknown()),
});

export const queryRecordsOutputSchema = {
  ok: z.boolean(),
  degraded: z.boolean(),
  results: z.array(queryResultSchema),
};

export type QueryRecordsInput = {
  query: string;
  collection?: (typeof collections)[number] | undefined;
  limit?: number | undefined;
};

type QueryRecord = z.infer<typeof queryResultSchema>;

type QueryRecordsStructuredOutput = {
  ok: true;
  degraded: boolean;
  results: QueryRecord[];
};

function searchResultToRecord(result: SearchResult): QueryRecord {
  if (result.source_table === "activity_logs") {
    const type = typeof result.metadata.type === "string" ? result.metadata.type : "activity";
    const source = typeof result.metadata.agent_id === "string" ? result.metadata.agent_id : "system";

    return {
      id: result.sqlite_id,
      collection: "activity_logs",
      title: `${type} from ${source}`,
      content: result.document,
      timestamp: typeof result.metadata.timestamp === "string" ? result.metadata.timestamp : "",
      metadata: result.metadata,
    };
  }

  return {
    id: result.sqlite_id,
    collection: result.collection === "ephemeral_memory" ? "ephemeral_memory" : "core_knowledge",
    title: typeof result.metadata.title === "string" ? result.metadata.title : result.sqlite_id,
    content: result.document,
    timestamp: typeof result.metadata.updated_at === "string" ? result.metadata.updated_at : "",
    metadata: result.metadata,
  };
}

function matchesRequestedCollection(result: SearchResult, collection: QueryRecordsInput["collection"]): boolean {
  if (!collection) {
    return true;
  }

  if (collection === "activity_logs") {
    return result.source_table === "activity_logs";
  }

  return result.source_table === "knowledge_items" && result.collection === collection;
}

export type QueryRecordsToolOptions = {
  chromaClient?: ChromaGateway;
};

async function querySearch(db: VegapunkDatabase, input: QueryRecordsInput, limit: number, options: QueryRecordsToolOptions): Promise<SearchResponse> {
  const searchLimit = Math.max(limit * 3, limit);

  if (options.chromaClient) {
    return search(db, input.query, { chromaClient: options.chromaClient, limit: searchLimit });
  }

  const unavailableChroma: ChromaGateway = {
    async heartbeat() {
      return false;
    },
    async getOrCreateCollection() {
      throw new Error("Chroma client was not provided to query_records");
    },
  };

  return search(db, input.query, { chromaClient: unavailableChroma, limit: searchLimit });
}

export async function queryRecordsTool(db: VegapunkDatabase, input: QueryRecordsInput, options: QueryRecordsToolOptions = {}): Promise<CallToolResult> {
  const limit = input.limit ?? 20;
  const response = await querySearch(db, input, limit, options);
  const results = response.results
    .filter((result) => matchesRequestedCollection(result, input.collection))
    .slice(0, limit)
    .map(searchResultToRecord);

  const payload: QueryRecordsStructuredOutput = {
    ok: true,
    degraded: response.degraded,
    results,
  };

  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
  };
}
