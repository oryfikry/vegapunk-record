import { describe, expect, test } from "bun:test";
import { SatelliteClient, SatelliteClientError, loadSatelliteConfig, runSatelliteOnce, satelliteErrorMessage, type McpToolCall, type SatelliteFetch } from "../../src/satellite";

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

function createMockFetch(): { fetch: SatelliteFetch; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];

  const fetchImpl: SatelliteFetch = async (input, init) => {
    const url = input instanceof URL ? input : new URL(input.toString());
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as unknown : undefined;
    requests.push({ path: url.pathname, method, body });

    if (url.pathname === "/api/agents/register") {
      const payload = body as Record<string, unknown>;
      return jsonResponse({ ...payload, status: "active", custom_llm: payload.custom_llm ?? null, created_at: "now", updated_at: "now" }, 201);
    }

    if (url.pathname === "/api/activity") {
      return jsonResponse({ id: `activity-${requests.length}`, ...(body as Record<string, unknown>) }, 201);
    }

    if (url.pathname.startsWith("/api/tasks/") && url.pathname.endsWith("/status")) {
      const taskId = decodeURIComponent(url.pathname.slice("/api/tasks/".length, -"/status".length));
      const payload = body as Record<string, unknown>;
      return jsonResponse({ task_id: taskId, assigned_to: "lilith", status: payload.status, updated_at: "now" });
    }

    return jsonResponse({ error: "not found", status: 404 }, 404);
  };

  return { fetch: fetchImpl, requests };
}

describe("SatelliteClient", () => {
  test("registers, emits activity, updates tasks, and calls mocked MCP in one bounded cycle", async () => {
    const { fetch, requests } = createMockFetch();
    const mcpCalls: McpToolCall[] = [];
    const client = new SatelliteClient({
      baseUrl: "http://stella.local/",
      fetch,
      mcpToolCaller: {
        async callTool(call) {
          mcpCalls.push(call);
          return { ok: true, tool: call.name };
        },
      },
    });

    const result = await runSatelliteOnce(client, {
      stellaUrl: "http://stella.local",
      once: true,
      agent: { id: "lilith", name: "Lilith", role: "satellite-researcher" },
      assignedTaskId: "task-1",
      mcp: { toolName: "query_records", arguments: { query: "bounded", limit: 1 } },
    }, {
      startedMessage: "Lilith started",
      completedMessage: "Lilith completed",
    });

    expect(result).toEqual({ agentId: "lilith", registered: true, taskUpdated: true, mcpCalled: true, once: true });
    expect(mcpCalls).toEqual([{ name: "query_records", arguments: { query: "bounded", limit: 1 } }]);
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /api/agents/register",
      "POST /api/activity",
      "PATCH /api/tasks/task-1/status",
      "POST /api/activity",
      "POST /api/activity",
      "POST /api/activity",
      "POST /api/activity",
      "PATCH /api/tasks/task-1/status",
      "POST /api/activity",
    ]);
    expect(requests[0]?.body).toEqual({ id: "lilith", name: "Lilith", role: "satellite-researcher" });
    expect(requests[2]?.body).toEqual({ status: "in_progress" });
    expect(requests[7]?.body).toEqual({ status: "completed" });
  });

  test("wraps Stella connection refusal in a controlled error message", async () => {
    const client = new SatelliteClient({
      baseUrl: "http://127.0.0.1:65535",
      fetch: async () => {
        throw new TypeError("fetch failed: ECONNREFUSED");
      },
    });

    await expect(client.registerAgent({ id: "lilith", name: "Lilith", role: "satellite-researcher" })).rejects.toThrow(SatelliteClientError);

    try {
      await client.registerAgent({ id: "lilith", name: "Lilith", role: "satellite-researcher" });
      throw new Error("Expected controlled failure");
    } catch (error) {
      expect(satelliteErrorMessage(error)).toBe("Unable to reach Stella at http://127.0.0.1:65535. Ensure Stella is running and STELLA_URL is correct.");
    }
  });

  test("loads defaults, --once, task assignment, and MCP config from env", () => {
    const config = loadSatelliteConfig({ id: "shaka", name: "Shaka", role: "satellite-operator" }, {
      STELLA_URL: "http://localhost:4000",
      SATELLITE_TASK_ID: "task-9",
      SATELLITE_CUSTOM_LLM: "mock",
      SATELLITE_MCP_TOOL: "query_records",
      SATELLITE_MCP_ARGUMENTS: "{\"query\":\"ops\"}",
    }, ["--once"]);

    expect(config).toEqual({
      stellaUrl: "http://localhost:4000",
      once: true,
      agent: { id: "shaka", name: "Shaka", role: "satellite-operator", customLlm: "mock" },
      assignedTaskId: "task-9",
      mcp: { toolName: "query_records", arguments: { query: "ops" } },
    });
  });
});
