import { SatelliteClient, createStreamableMcpToolCaller, loadSatelliteConfig, runSatelliteOnce, satelliteErrorMessage, type McpToolCaller, type SatelliteCycleResult } from "../../src/satellite";

export const shakaDefinition = {
  id: "shaka",
  name: "Shaka",
  role: "satellite-operator",
} as const;

export async function runShaka(argv: readonly string[] = Bun.argv.slice(2), env: Record<string, string | undefined> = Bun.env): Promise<SatelliteCycleResult> {
  const config = loadSatelliteConfig(shakaDefinition, env, argv);
  let mcpToolCaller: McpToolCaller | undefined;

  try {
    if (config.mcp !== undefined) {
      mcpToolCaller = await createStreamableMcpToolCaller(new URL("/mcp", `${config.stellaUrl.replace(/\/+$/, "")}/`).toString(), "shaka-satellite");
    }

    const client = new SatelliteClient({ baseUrl: config.stellaUrl, mcpToolCaller });

    return await runSatelliteOnce(client, config, {
      startedMessage: "Shaka started a bounded operations synchronization cycle.",
      completedMessage: "Shaka completed one bounded operations synchronization cycle.",
      metadata: { specialty: "task-operations" },
    });
  } finally {
    await mcpToolCaller?.close?.();
  }
}

if (import.meta.main) {
  try {
    const result = await runShaka();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(satelliteErrorMessage(error));
    process.exit(1);
  }
}
