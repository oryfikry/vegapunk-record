export type SatelliteAgentConfig = {
  id: string;
  name: string;
  role: string;
  customLlm?: string | null | undefined;
};

export type SatelliteMcpConfig = {
  toolName: string;
  arguments: Record<string, unknown>;
};

export type SatelliteConfig = {
  stellaUrl: string;
  once: boolean;
  agent: SatelliteAgentConfig;
  assignedTaskId?: string | undefined;
  mcp?: SatelliteMcpConfig | undefined;
};

export type SatelliteDefinition = {
  id: string;
  name: string;
  role: string;
};

type Env = Record<string, string | undefined>;

const defaultStellaUrl = "http://127.0.0.1:3000";

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function parseMcpArguments(value: string | undefined): Record<string, unknown> {
  const raw = nonEmpty(value);
  if (!raw) {
    return {};
  }

  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("SATELLITE_MCP_ARGUMENTS must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

export function hasOnceFlag(argv: readonly string[]): boolean {
  return argv.includes("--once");
}

export function loadSatelliteConfig(definition: SatelliteDefinition, env: Env = Bun.env, argv: readonly string[] = Bun.argv.slice(2)): SatelliteConfig {
  const idPrefix = definition.id.toUpperCase().replaceAll("-", "_");
  const stellaUrl = nonEmpty(env.STELLA_URL) ?? defaultStellaUrl;
  const agentId = nonEmpty(env.SATELLITE_ID) ?? definition.id;
  const agentName = nonEmpty(env.SATELLITE_NAME) ?? definition.name;
  const agentRole = nonEmpty(env.SATELLITE_ROLE) ?? definition.role;
  const customLlm = env.SATELLITE_CUSTOM_LLM === "" ? null : nonEmpty(env.SATELLITE_CUSTOM_LLM);
  const assignedTaskId = nonEmpty(env.SATELLITE_TASK_ID) ?? nonEmpty(env[`${idPrefix}_TASK_ID`]);
  const mcpToolName = nonEmpty(env.SATELLITE_MCP_TOOL);

  const agent = customLlm === undefined
    ? { id: agentId, name: agentName, role: agentRole }
    : { id: agentId, name: agentName, role: agentRole, customLlm };

  const config: SatelliteConfig = {
    stellaUrl,
    once: hasOnceFlag(argv),
    agent,
  };

  if (assignedTaskId !== undefined) {
    config.assignedTaskId = assignedTaskId;
  }

  if (mcpToolName !== undefined) {
    config.mcp = {
      toolName: mcpToolName,
      arguments: parseMcpArguments(env.SATELLITE_MCP_ARGUMENTS),
    };
  }

  return config;
}
