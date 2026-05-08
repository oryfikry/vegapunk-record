import { describe, expect, test } from "bun:test";
import { describeScaffold, localDefaults } from "../src/index";

describe("scaffold sanity", () => {
  test("uses local-first safe defaults without provider keys", () => {
    expect(localDefaults.host).toBe("127.0.0.1");
    expect(localDefaults.port).toBe(3003);
    expect(localDefaults.sqlitePath).toBe("./data/punk-records.sqlite");
    expect(localDefaults.chromaHost).toBe("127.0.0.1");
    expect(localDefaults.chromaPort).toBe(8000);
    expect(localDefaults.llmProvider).toBe("mock");
    expect(describeScaffold()).toContain("local-first safe defaults");
  });
});
