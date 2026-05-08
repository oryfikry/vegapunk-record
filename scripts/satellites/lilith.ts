import { SatelliteClient, createStreamableMcpToolCaller, loadSatelliteConfig, runSatelliteOnce, satelliteErrorMessage, type McpToolCaller, type SatelliteCycleResult } from "../../src/satellite";

export const lilithDefinition = {
  id: "lilith",
  name: "Lilith",
  role: "satellite-researcher",
} as const;

export async function runLilith(argv: readonly string[] = Bun.argv.slice(2), env: Record<string, string | undefined> = Bun.env): Promise<SatelliteCycleResult> {
  const config = loadSatelliteConfig(lilithDefinition, env, argv);
  let mcpToolCaller: McpToolCaller | undefined;

  try {
    if (config.mcp !== undefined) {
      mcpToolCaller = await createStreamableMcpToolCaller(new URL("/mcp", `${config.stellaUrl.replace(/\/+$/, "")}/`).toString(), "lilith-satellite");
    }

    const client = new SatelliteClient({ baseUrl: config.stellaUrl, mcpToolCaller });

    return await runSatelliteOnce(client, config, {
      startedMessage: "Lilith started a bounded research synchronization cycle.",
      completedMessage: "Lilith completed one bounded research synchronization cycle.",
      metadata: { specialty: "records-research" },
    });
  } finally {
    await mcpToolCaller?.close?.();
  }
}

if (import.meta.main) {
  try {
    const result = await runLilith();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(satelliteErrorMessage(error));
    process.exit(1);
  }
}
