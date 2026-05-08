import { loadConfig } from "../config";
import { createDatabase } from "../db";
import { log } from "../security";
import { createApp } from "./app";

const bootstrapDb = createDatabase(Bun.env.SQLITE_PATH ?? "./data/punk-records.sqlite");
const config = loadConfig(bootstrapDb);

if (config.host === "0.0.0.0") {
  throw new Error("Refusing to bind Stella to 0.0.0.0 by default; set HOST to a local interface such as 127.0.0.1.");
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
