import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ActivityLevel, ActivityType, Agent, Task, TaskStatus } from "../db";
import type { SatelliteConfig } from "./config";

export type SatelliteFetchInput = Request | string | URL;
export type SatelliteFetch = (input: SatelliteFetchInput, init?: RequestInit) => Promise<Response>;

export type RegisterAgentPayload = {
  id: string;
  name: string;
  role: string;
  custom_llm?: string | null | undefined;
};

export type SendActivityPayload = {
  agent_id: string;
  type: ActivityType;
  message: string;
  level?: ActivityLevel | undefined;
  task_id?: string | undefined;
  source?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type McpToolCall = {
  name: string;
  arguments?: Record<string, unknown> | undefined;
};

export type McpToolCaller = {
  callTool(call: McpToolCall): Promise<unknown>;
  close?(): Promise<void>;
};

export type SatelliteClientOptions = {
  baseUrl?: string | undefined;
  fetch?: SatelliteFetch | undefined;
  mcpToolCaller?: McpToolCaller | undefined;
};

export type SatelliteCycleProfile = {
  startedMessage: string;
  completedMessage: string;
  metadata?: Record<string, unknown> | undefined;
};

export type SatelliteCycleResult = {
  agentId: string;
  registered: true;
  taskUpdated: boolean;
  mcpCalled: boolean;
  once: boolean;
};

export class SatelliteClientError extends Error {
  readonly originalCause?: unknown;

  constructor(message: string, originalCause?: unknown) {
    super(message);
    this.name = "SatelliteClientError";
    this.originalCause = originalCause;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function controlledConnectionMessage(baseUrl: string): string {
  return `Unable to reach Stella at ${baseUrl}. Ensure Stella is running and STELLA_URL is correct.`;
}

function isConnectionFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === "TypeError" || /ECONNREFUSED|fetch failed|Failed to fetch|Unable to connect/i.test(error.message);
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim().length === 0) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

function responseErrorMessage(path: string, status: number, body: unknown): string {
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return `Stella request failed for ${path}: ${body.error}`;
  }

  return `Stella request failed for ${path}: HTTP ${status}`;
}

export class SatelliteClient {
  readonly baseUrl: string;
  private readonly fetchImpl: SatelliteFetch;
  private readonly mcpToolCaller?: McpToolCaller | undefined;

  constructor(options: SatelliteClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? "http://127.0.0.1:3003");
    this.fetchImpl = options.fetch ?? fetch;
    this.mcpToolCaller = options.mcpToolCaller;
  }

  async registerAgent(payload: RegisterAgentPayload): Promise<Agent> {
    return this.requestJson<Agent>("/api/agents/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async sendActivity(payload: SendActivityPayload): Promise<unknown> {
    return this.requestJson<unknown>("/api/activity", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
    return this.requestJson<Task>(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async callMcpTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.mcpToolCaller) {
      throw new SatelliteClientError("MCP tool caller is not configured for this satellite client.");
    }

    return this.mcpToolCaller.callTool({ name, arguments: args });
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;

    try {
      response = await this.fetchImpl(new URL(path, `${this.baseUrl}/`), {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init.headers ?? {}),
        },
      });
    } catch (error) {
      if (isConnectionFailure(error)) {
        throw new SatelliteClientError(controlledConnectionMessage(this.baseUrl), error);
      }

      throw error;
    }

    const body = await parseJson(response);
    if (!response.ok) {
      throw new SatelliteClientError(responseErrorMessage(path, response.status, body));
    }

    return body as T;
  }
}

export async function createStreamableMcpToolCaller(endpoint: string, clientName = "vegapunk-satellite"): Promise<McpToolCaller> {
  const client = new Client({ name: clientName, version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)) as unknown as Transport);

  return {
    callTool(call) {
      return client.callTool({ name: call.name, arguments: call.arguments ?? {} });
    },
    close() {
      return client.close();
    },
  };
}

export function satelliteErrorMessage(error: unknown): string {
  if (error instanceof SatelliteClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return `Satellite execution failed: ${error.message}`;
  }

  return "Satellite execution failed with an unknown error.";
}

export async function runSatelliteOnce(client: SatelliteClient, config: SatelliteConfig, profile: SatelliteCycleProfile): Promise<SatelliteCycleResult> {
  const agentPayload: RegisterAgentPayload = config.agent.customLlm === undefined
    ? { id: config.agent.id, name: config.agent.name, role: config.agent.role }
    : { id: config.agent.id, name: config.agent.name, role: config.agent.role, custom_llm: config.agent.customLlm };

  await client.registerAgent(agentPayload);
  await client.sendActivity({
    agent_id: config.agent.id,
    type: "message",
    message: profile.startedMessage,
    metadata: { satellite: config.agent.id, once: config.once, ...(profile.metadata ?? {}) },
  });

  let taskUpdated = false;
  if (config.assignedTaskId !== undefined) {
    await client.updateTaskStatus(config.assignedTaskId, "in_progress");
    await client.sendActivity({
      agent_id: config.agent.id,
      task_id: config.assignedTaskId,
      type: "task_update",
      message: `${config.agent.name} marked assigned task in_progress`,
      metadata: { status: "in_progress" },
    });
    taskUpdated = true;
  }

  let mcpCalled = false;
  if (config.mcp !== undefined) {
    await client.sendActivity({
      agent_id: config.agent.id,
      type: "tool_call",
      message: `${config.agent.name} calling MCP tool ${config.mcp.toolName}`,
      metadata: { tool: config.mcp.toolName },
    });
    const result = await client.callMcpTool(config.mcp.toolName, config.mcp.arguments);
    await client.sendActivity({
      agent_id: config.agent.id,
      type: "tool_result",
      message: `${config.agent.name} received MCP tool result`,
      metadata: { tool: config.mcp.toolName, result },
    });
    mcpCalled = true;
  }

  await client.sendActivity({
    agent_id: config.agent.id,
    type: "summary",
    message: profile.completedMessage,
    metadata: { satellite: config.agent.id, once: config.once, taskUpdated, mcpCalled },
  });

  if (config.assignedTaskId !== undefined) {
    await client.updateTaskStatus(config.assignedTaskId, "completed");
    await client.sendActivity({
      agent_id: config.agent.id,
      task_id: config.assignedTaskId,
      type: "task_update",
      message: `${config.agent.name} marked assigned task completed`,
      metadata: { status: "completed" },
    });
  }

  return {
    agentId: config.agent.id,
    registered: true,
    taskUpdated,
    mcpCalled,
    once: config.once,
  };
}
