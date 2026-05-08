import { describe, expect, test } from "bun:test";
import { search } from "../../src/search";
import type { ChromaCollection, ChromaGateway } from "../../src/chroma";
import { createTemporaryDatabase } from "./helpers";

describe("Chroma-backed search", () => {
  test("returns Chroma results when available", async () => {
    const db = createTemporaryDatabase();
    const collection: ChromaCollection = {
      name: "core_knowledge",
      async upsert() {},
      async query() {
        return {
          ids: [["knowledge-1"]],
          documents: [["Pirate king notes"]],
          metadatas: [[{ sqlite_id: "knowledge-1", source_table: "knowledge_items", type: "knowledge_item" }]],
          distances: [[0.12]],
        };
      },
    };
    const client: ChromaGateway = {
      async heartbeat() {
        return true;
      },
      async getOrCreateCollection(name) {
        return name === "core_knowledge" ? collection : { ...collection, name, async query() { return { ids: [[]], documents: [[]], metadatas: [[]], distances: [[]] }; } };
      },
    };

    const response = await search(db, "pirate", { chromaClient: client, limit: 5 });

    expect(response.degraded).toBe(false);
    expect(response.results).toEqual([
      {
        id: "knowledge-1",
        sqlite_id: "knowledge-1",
        source_table: "knowledge_items",
        collection: "core_knowledge",
        document: "Pirate king notes",
        metadata: { sqlite_id: "knowledge-1", source_table: "knowledge_items", type: "knowledge_item" },
        distance: 0.12,
      },
    ]);
  });

  test("falls back to SQLite LIKE search with degraded flag when Chroma throws", async () => {
    const db = createTemporaryDatabase();
    db.knowledge.create({ id: "knowledge-fallback", collection: "core_knowledge", title: "Sunny", content: "Thousand Sunny ship notes" });
    db.activities.create({ id: "activity-fallback", type: "message", level: "info", source: "test", message: "Sunny activity log" });
    const client: ChromaGateway = {
      async heartbeat() {
        return false;
      },
      async getOrCreateCollection() {
        throw new Error("Chroma unavailable");
      },
    };

    const response = await search(db, "Sunny", { chromaClient: client, limit: 10 });

    expect(response.degraded).toBe(true);
    expect(response.results.map((result) => result.sqlite_id)).toContain("knowledge-fallback");
    expect(response.results.map((result) => result.sqlite_id)).toContain("activity-fallback");
    expect(response.results.every((result) => result.metadata.sqlite_id === result.sqlite_id)).toBe(true);
  });
});
