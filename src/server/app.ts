import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import type { StellaConfig } from "../config";
import { defaultConfig } from "../config";
import type { VegapunkDatabase } from "../db";
import { createErrorHandler } from "./error-handler";
import { ActivityStream, createActivityRoutes, createActivityStreamRoutes, createAgentsRoutes, createTasksRoutes } from "./routes";

export type CreateAppOptions = {
  db: VegapunkDatabase;
  config?: StellaConfig;
};

export function createApp({ db, config = defaultConfig }: CreateAppOptions) {
  const activityStream = new ActivityStream();

  return new Elysia()
    .decorate("db", db)
    .decorate("config", config)
    .use(staticPlugin({ assets: "public", prefix: "/public", silent: true }))
    .use(createAgentsRoutes(db, activityStream))
    .use(createTasksRoutes(db))
    .use(createActivityRoutes(db, activityStream))
    .use(createActivityStreamRoutes(activityStream))
    .onError(createErrorHandler(config.nodeEnv))
    .get("/health", () => ({ ok: true, service: "stella" as const }))
    .get("/", ({ set }) => {
      set.headers["content-type"] = "text/html; charset=utf-8";

      return "<!doctype html><html lang=\"en\"><head><title>Stella</title></head><body><main><h1>Stella</h1><p>Vegapunk-Record dashboard placeholder.</p></main></body></html>";
    });
}

export type StellaApp = ReturnType<typeof createApp>;
