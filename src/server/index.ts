import { loadConfig } from "../config";
import { createDatabase } from "../db";
import { log } from "../security";
import { createApp } from "./app";

const bootstrapDb = createDatabase(Bun.env.SQLITE_PATH ?? "./data/punk-records.sqlite");
const config = loadConfig(bootstrapDb);

if (config.host === "0.0.0.0" && Bun.env.STELLA_ALLOW_PUBLIC_BIND !== "1") {
  throw new Error("Refusing to bind Stella to 0.0.0.0 unless STELLA_ALLOW_PUBLIC_BIND=1 is set. Put Stella behind a firewall or reverse proxy before enabling public binds.");
}

const app = createApp({ db: bootstrapDb, config });

app.listen({ hostname: config.host, port: config.port });

log("info", "Stella server started", {
  host: config.host,
  port: config.port,
  sqlitePath: config.sqlitePath,
  llmProvider: config.llmProvider,
});

export { app, bootstrapDb, config };
