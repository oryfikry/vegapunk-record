import { defaultConfig, type StellaConfig } from "./config";

export type LocalDefaults = Pick<StellaConfig, "host" | "port" | "sqlitePath" | "chromaHost" | "chromaPort" | "llmProvider">;

export const localDefaults: LocalDefaults = {
  host: defaultConfig.host,
  port: defaultConfig.port,
  sqlitePath: defaultConfig.sqlitePath,
  chromaHost: defaultConfig.chromaHost,
  chromaPort: defaultConfig.chromaPort,
  llmProvider: defaultConfig.llmProvider,
};

export function describeScaffold(): string {
  return "Vegapunk-Record scaffold is ready with local-first safe defaults.";
}
