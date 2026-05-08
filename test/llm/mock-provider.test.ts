import { describe, expect, test } from "bun:test";
import { MockProvider } from "../../src/llm";

describe("MockProvider", () => {
  test("returns deterministic responses for identical requests", async () => {
    const provider = new MockProvider();
    const request = {
      model: "mock-test",
      messages: [
        { role: "system", content: "You are deterministic." },
        { role: "user", content: "Summarize Vegapunk records." },
      ],
      temperature: 0.2,
      max_tokens: 32,
    };

    const first = await provider.complete(request);
    const second = await provider.complete(request);

    expect(await provider.isAvailable()).toBe(true);
    expect(first).toEqual(second);
    expect(first.provider).toBe("mock");
    expect(first.model).toBe("mock-test");
    expect(first.content).toContain("mock:");
    expect(first.content).toContain("Summarize Vegapunk records.");
    expect(first.usage).toEqual({ prompt_tokens: 12, completion_tokens: 24 });
  });

  test("changes response when input messages change", async () => {
    const provider = new MockProvider();

    const first = await provider.complete({ messages: [{ role: "user", content: "alpha" }] });
    const second = await provider.complete({ messages: [{ role: "user", content: "beta" }] });

    expect(first.content).not.toBe(second.content);
  });
});
