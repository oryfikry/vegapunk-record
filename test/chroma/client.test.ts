import { describe, expect, test } from "bun:test";
import { createChromaClient, getChromaConnectionConfig, setupChromaCollections, type ChromaCollection } from "../../src/chroma";

function mockCollection(name: string): ChromaCollection {
  return {
    name,
    async upsert() {},
    async query() {
      return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] };
    },
  };
}

describe("Chroma client wrapper", () => {
  test("reads host and port defaults from env-compatible input", () => {
    expect(getChromaConnectionConfig({})).toEqual({
      host: "127.0.0.1",
      port: 8000,
      path: "http://127.0.0.1:8000",
    });

    expect(getChromaConnectionConfig({ CHROMA_HOST: "chroma", CHROMA_PORT: "8123" })).toEqual({
      host: "chroma",
      port: 8123,
      path: "http://chroma:8123",
    });
  });

  test("heartbeat returns true when Chroma responds", async () => {
    const client = createChromaClient({
      client: {
        async heartbeat() {
          return true;
        },
        async getOrCreateCollection(name) {
          return mockCollection(name);
        },
      },
    });

    await expect(client.heartbeat()).resolves.toBe(true);
  });

  test("setup creates the three derived collections", async () => {
    const created: string[] = [];
    const client = createChromaClient({
      client: {
        async heartbeat() {
          return true;
        },
        async getOrCreateCollection(name) {
          created.push(name);
          return mockCollection(name);
        },
      },
    });

    const collections = await setupChromaCollections(client);

    expect(Object.keys(collections).sort()).toEqual(["activity_logs", "core_knowledge", "ephemeral_memory"]);
    expect(created).toEqual(["ephemeral_memory", "core_knowledge", "activity_logs"]);
  });
});
