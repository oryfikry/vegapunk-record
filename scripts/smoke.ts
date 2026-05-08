type JsonRecord = Record<string, unknown>;

const baseUrl = Bun.env.STELLA_URL ?? "http://127.0.0.1:3000";
const shouldStartServer = Bun.env.SMOKE_START_SERVER === "1";
const smokeAgentId = `smoke-${Date.now()}`;

function assertRecord(value: unknown, label: string): asserts value is JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} did not return a JSON object`);
  }
}

async function readJson(response: Response, label: string): Promise<unknown> {
  const text = await response.text();
  try {
    return text.length > 0 ? JSON.parse(text) : null;
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${(error as Error).message}`);
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(new URL(path, baseUrl), init);
  const body = await readJson(response, path);

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + 15_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const health = await request("/health");
      assertRecord(health, "/health");
      if (health.ok === true && health.service === "stella") {
        return;
      }
      lastError = new Error(`unexpected health payload: ${JSON.stringify(health)}`);
    } catch (error) {
      lastError = error;
    }

    await Bun.sleep(500);
  }

  throw new Error(`Stella health check did not pass: ${(lastError as Error | undefined)?.message ?? "timed out"}`);
}

async function runSmoke(): Promise<void> {
  await waitForHealth();

  const agent = await request("/api/agents/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: smokeAgentId,
      name: "Smoke Test Agent",
      role: "smoke-test",
      custom_llm: null,
    }),
  });
  assertRecord(agent, "agent registration");
  if (agent.id !== smokeAgentId || agent.status !== "active") {
    throw new Error(`agent registration returned unexpected payload: ${JSON.stringify(agent)}`);
  }

  const activity = await request("/api/activity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      agent_id: smokeAgentId,
      type: "message",
      level: "info",
      source: "smoke",
      message: "Smoke test activity",
      metadata: { smoke: true },
    }),
  });
  assertRecord(activity, "activity creation");
  if (activity.agent_id !== smokeAgentId || activity.message !== "Smoke test activity") {
    throw new Error(`activity creation returned unexpected payload: ${JSON.stringify(activity)}`);
  }

  const activities = await request(`/api/activity?agent_id=${encodeURIComponent(smokeAgentId)}&type=message&limit=10`);
  if (!Array.isArray(activities) || !activities.some((item) => {
    return typeof item === "object" && item !== null && "message" in item && item.message === "Smoke test activity";
  })) {
    throw new Error(`activity query did not include smoke activity: ${JSON.stringify(activities)}`);
  }

  console.log("Smoke test passed");
}

let server: Bun.Subprocess | undefined;

try {
  if (shouldStartServer) {
    server = Bun.spawn(["bun", "run", "start"], {
      env: {
        ...Bun.env,
        HOST: "127.0.0.1",
        PORT: "3000",
        SQLITE_PATH: Bun.env.SQLITE_PATH ?? "./data/smoke.sqlite",
        LLM_PROVIDER: "mock",
      },
      stdout: "inherit",
      stderr: "inherit",
    });
  }

  await runSmoke();
} finally {
  server?.kill();
}
