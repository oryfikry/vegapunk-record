import type { VegapunkDatabase } from "../db";

export type LlmProvider = "mock" | "openai" | "anthropic" | "ollama" | string;

export type StellaConfig = {
  host: string;
  port: number;
  sqlitePath: string;
  chromaHost: string;
  chromaPort: number;
  llmProvider: LlmProvider;
  nodeEnv: string;
};

export type ConfigEnvironment = Record<string, string | undefined>;

export const defaultConfig: StellaConfig = {
  host: "127.0.0.1",
  port: 3000,
  sqlitePath: "./data/punk-records.sqlite",
  chromaHost: "127.0.0.1",
  chromaPort: 8000,
  llmProvider: "mock",
  nodeEnv: "development",
};

const configKeys = {
  host: "HOST",
  port: "PORT",
  sqlitePath: "SQLITE_PATH",
  chromaHost: "CHROMA_HOST",
  chromaPort: "CHROMA_PORT",
  llmProvider: "LLM_PROVIDER",
  nodeEnv: "NODE_ENV",
} as const satisfies Record<keyof StellaConfig, string>;

type ConfigKey = keyof StellaConfig;

type ConfigValues = Partial<Record<ConfigKey, string>>;

function readSqliteConfig(db: VegapunkDatabase | null | undefined): ConfigValues {
  if (!db) {
    return {};
  }

  const rows = db.configs.list();
  const values: ConfigValues = {};

  for (const key of Object.keys(configKeys) as ConfigKey[]) {
    const row = rows.find((candidate) => candidate.key === configKeys[key] || candidate.key === key);

    if (row) {
      values[key] = row.value;
    }
  }

  return values;
}

function readEnvConfig(env: ConfigEnvironment): ConfigValues {
  const values: ConfigValues = {};

  for (const key of Object.keys(configKeys) as ConfigKey[]) {
    const value = env[configKeys[key]];

    if (value !== undefined && value !== "") {
      values[key] = value;
    }
  }

  return values;
}

function parsePort(value: string | number, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    return fallback;
  }

  return parsed;
}

function mergeConfig(sqliteValues: ConfigValues, envValues: ConfigValues): StellaConfig {
  const raw = {
    host: envValues.host ?? sqliteValues.host ?? defaultConfig.host,
    port: envValues.port ?? sqliteValues.port ?? String(defaultConfig.port),
    sqlitePath: envValues.sqlitePath ?? sqliteValues.sqlitePath ?? defaultConfig.sqlitePath,
    chromaHost: envValues.chromaHost ?? sqliteValues.chromaHost ?? defaultConfig.chromaHost,
    chromaPort: envValues.chromaPort ?? sqliteValues.chromaPort ?? String(defaultConfig.chromaPort),
    llmProvider: envValues.llmProvider ?? sqliteValues.llmProvider ?? defaultConfig.llmProvider,
    nodeEnv: envValues.nodeEnv ?? sqliteValues.nodeEnv ?? defaultConfig.nodeEnv,
  };

  return {
    host: raw.host,
    port: parsePort(raw.port, defaultConfig.port),
    sqlitePath: raw.sqlitePath,
    chromaHost: raw.chromaHost,
    chromaPort: parsePort(raw.chromaPort, defaultConfig.chromaPort),
    llmProvider: raw.llmProvider,
    nodeEnv: raw.nodeEnv,
  };
}

export function loadConfig(db?: VegapunkDatabase | null, env: ConfigEnvironment = Bun.env): StellaConfig {
  return mergeConfig(readSqliteConfig(db), readEnvConfig(env));
}
