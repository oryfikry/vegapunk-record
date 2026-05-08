import { afterEach, describe, expect, mock, test } from "bun:test";

const originalFetch = globalThis.fetch;

type RecordedRequest = {
  path: string;
  method: string;
  body: unknown;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function installMockFetch(): RecordedRequest[] {
  const requests: RecordedRequest[] = [];
  globalThis.fetch = mock(async (input: Request | string | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(input.toString());
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as unknown : undefined;
    requests.push({ path: url.pathname, method: init?.method ?? "GET", body });

    if (url.pathname === "/api/agents/register") {
      const payload = body as Record<string, unknown>;
      return jsonResponse({ ...payload, status: "active", custom_llm: null, created_at: "now", updated_at: "now" }, 201);
    }

    if (url.pathname === "/api/activity") {
      return jsonResponse({ id: `activity-${requests.length}`, ...(body as Record<string, unknown>) }, 201);
    }

    return jsonResponse({ error: "unexpected path", status: 404 }, 404);
  }) as unknown as typeof fetch;

  return requests;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Lilith satellite script", () => {
  test("runs one offline mocked cycle with --once", async () => {
    const requests = installMockFetch();
    const { runLilith } = await import("../../scripts/satellites/lilith");

    const result = await runLilith(["--once"], { STELLA_URL: "http://mock-stella" });

    expect(result).toEqual({ agentId: "lilith", registered: true, taskUpdated: false, mcpCalled: false, once: true });
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /api/agents/register",
      "POST /api/activity",
      "POST /api/activity",
    ]);
    expect(requests[0]?.body).toEqual({ id: "lilith", name: "Lilith", role: "satellite-researcher" });
    expect(requests[1]?.body).toMatchObject({ agent_id: "lilith", type: "message" });
    expect(requests[2]?.body).toMatchObject({ agent_id: "lilith", type: "summary" });
  });
});
