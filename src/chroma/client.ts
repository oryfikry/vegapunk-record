import { ChromaClient, type Collection, type Metadata } from "chromadb";

export type ChromaCollectionName = "ephemeral_memory" | "core_knowledge" | "activity_logs";

export type ChromaMetadataValue = boolean | number | string | null;
export type ChromaRecordMetadata = Record<string, ChromaMetadataValue>;
export type ChromaInclude = "distances" | "documents" | "embeddings" | "metadatas" | "uris";

export type ChromaQueryResult = {
  ids?: string[][];
  documents?: (string | null)[][];
  metadatas?: (ChromaRecordMetadata | null)[][];
  distances?: (number | null)[][];
};

export type ChromaCollection = {
  name: string;
  upsert(args: {
    ids: string[];
    documents: string[];
    metadatas: ChromaRecordMetadata[];
  }): Promise<void>;
  query(args: {
    queryTexts: string[];
    nResults: number;
    include?: ChromaInclude[];
  }): Promise<ChromaQueryResult>;
};

export type ChromaGateway = {
  heartbeat(): Promise<boolean>;
  getOrCreateCollection(name: ChromaCollectionName): Promise<ChromaCollection | null>;
};

export type ChromaClientOptions = {
  host?: string;
  port?: number;
  client?: ChromaGateway;
};

export class ChromaUnavailableError extends Error {
  override name = "ChromaUnavailableError";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : fallback;
}

export function getChromaConnectionConfig(env: Record<string, string | undefined> = Bun.env): { host: string; port: number; path: string } {
  const host = env.CHROMA_HOST && env.CHROMA_HOST.length > 0 ? env.CHROMA_HOST : "127.0.0.1";
  const port = parsePort(env.CHROMA_PORT, 8000);

  return {
    host,
    port,
    path: `http://${host}:${port}`,
  };
}

export function createChromaClient(options: ChromaClientOptions = {}): ChromaGateway {
  const config = getChromaConnectionConfig();
  const host = options.host ?? config.host;
  const port = options.port ?? config.port;

  if (options.client) {
    return options.client;
  }

  const client = new ChromaClient({ path: `http://${host}:${port}` });

  return {
    async heartbeat(): Promise<boolean> {
      try {
        await client.heartbeat();
        return true;
      } catch (error) {
        throw new ChromaUnavailableError("Chroma heartbeat failed", { cause: error });
      }
    },

    async getOrCreateCollection(name: ChromaCollectionName): Promise<ChromaCollection | null> {
      try {
        const collection = await client.getOrCreateCollection({
          name,
          metadata: {
            derived_from: "sqlite",
            canonical_id_field: "sqlite_id",
          },
        });

        return adaptChromaCollection(collection);
      } catch (error) {
        throw new ChromaUnavailableError(`Chroma collection unavailable: ${name}`, { cause: error });
      }
    },
  };
}

function toChromaMetadata(metadata: ChromaRecordMetadata[]): Metadata[] {
  return metadata.map((record) => ({ ...record }));
}

function fromChromaMetadata(metadata: (Metadata | null)[][] | undefined): (ChromaRecordMetadata | null)[][] | undefined {
  return metadata?.map((row) => row.map((record) => {
    if (!record) {
      return null;
    }

    const converted: ChromaRecordMetadata = {};

    for (const [key, value] of Object.entries(record)) {
      if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        converted[key] = value;
      }
    }

    return converted;
  }));
}

function adaptChromaCollection(collection: Collection): ChromaCollection {
  return {
    name: collection.name,
    async upsert(args) {
      await collection.upsert({
        ids: args.ids,
        documents: args.documents,
        metadatas: toChromaMetadata(args.metadatas),
      });
    },
    async query(args) {
      const queryArgs: Parameters<Collection["query"]>[0] = {
        queryTexts: args.queryTexts,
        nResults: args.nResults,
      };

      if (args.include) {
        queryArgs.include = args.include;
      }

      const response = await collection.query(queryArgs);

      const queryResult: ChromaQueryResult = {
        ids: response.ids,
        documents: response.documents,
        distances: response.distances,
      };

      const metadatas = fromChromaMetadata(response.metadatas);

      if (metadatas) {
        queryResult.metadatas = metadatas;
      }

      return queryResult;
    },
  };
}

export const chroma = createChromaClient();
