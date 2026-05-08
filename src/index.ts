export type LocalDefaults = {
  host: string;
  port: number;
  sqlitePath: string;
  chromaHost: string;
  chromaPort: number;
  llmProvider: "mock";
};

export const localDefaults: LocalDefaults = {
  host: Bun.env.HOST ?? "127.0.0.1",
  port: Number(Bun.env.PORT ?? "3000"),
  sqlitePath: Bun.env.SQLITE_PATH ?? "./data/punk-records.sqlite",
  chromaHost: Bun.env.CHROMA_HOST ?? "127.0.0.1",
  chromaPort: Number(Bun.env.CHROMA_PORT ?? "8000"),
  llmProvider: "mock",
};

export function describeScaffold(): string {
  return "Vegapunk-Record scaffold is ready with local-first safe defaults.";
}
