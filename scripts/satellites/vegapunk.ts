import { satelliteErrorMessage, type SatelliteCycleResult } from "../../src/satellite";
import { runLilith } from "./lilith";
import { runShaka } from "./shaka";

type SatelliteProfile = "lilith" | "shaka";

const defaultProfile: SatelliteProfile = "lilith";

const helpText = `Run one bounded Vegapunk Satellite client cycle against Stella.

Usage:
  bun run vegapunk:satellite [--profile lilith|shaka] [--once]

Options:
  --profile <name>           Select satellite identity: lilith or shaka.
  --help, -h                 Show this help text.

Environment:
  SATELLITE_PROFILE          Alternative way to select lilith or shaka.
  STELLA_URL                 Stella base URL. Defaults to http://127.0.0.1:3003.
  SATELLITE_MCP_TOOL         Optional MCP tool to call through Stella /mcp.
  SATELLITE_MCP_ARGUMENTS    Optional JSON object for SATELLITE_MCP_TOOL.

The default is local-first and safe: profile lilith, STELLA_URL http://127.0.0.1:3003,
one bounded --once cycle, and no MCP tool call unless SATELLITE_MCP_TOOL is set.`;

function normalizeProfile(value: string | undefined): SatelliteProfile | undefined {
  const profile = value?.trim().toLowerCase();
  if (profile === "lilith" || profile === "shaka") {
    return profile;
  }

  return undefined;
}

function parseArgs(argv: readonly string[], env: Record<string, string | undefined>): { help: boolean; profile: SatelliteProfile; forwardedArgv: string[] } {
  const forwardedArgv: string[] = [];
  let profile = normalizeProfile(env.SATELLITE_PROFILE) ?? defaultProfile;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      return { help: true, profile, forwardedArgv };
    }

    if (arg === "--profile") {
      const selectedProfile = normalizeProfile(argv[index + 1]);
      if (selectedProfile === undefined) {
        throw new Error("--profile must be followed by lilith or shaka");
      }

      profile = selectedProfile;
      index += 1;
      continue;
    }

    if (arg.startsWith("--profile=")) {
      const selectedProfile = normalizeProfile(arg.substring("--profile=".length));
      if (selectedProfile === undefined) {
        throw new Error("--profile must be lilith or shaka");
      }

      profile = selectedProfile;
      continue;
    }

    forwardedArgv.push(arg);
  }

  if (!forwardedArgv.includes("--once")) {
    forwardedArgv.push("--once");
  }

  return { help: false, profile, forwardedArgv };
}

export async function runVegapunkSatellite(argv: readonly string[] = Bun.argv.slice(2), env: Record<string, string | undefined> = Bun.env): Promise<SatelliteCycleResult | undefined> {
  const { help, profile, forwardedArgv } = parseArgs(argv, env);

  if (help) {
    console.log(helpText);
    return undefined;
  }

  if (profile === "shaka") {
    return runShaka(forwardedArgv, env);
  }

  return runLilith(forwardedArgv, env);
}

if (import.meta.main) {
  try {
    const result = await runVegapunkSatellite();
    if (result !== undefined) {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(satelliteErrorMessage(error));
    process.exit(1);
  }
}
