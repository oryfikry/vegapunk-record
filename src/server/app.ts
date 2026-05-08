import { readFileSync } from "node:fs";
import { staticPlugin } from "@elysiajs/static";
import { Elysia } from "elysia";
import type { ChromaGateway } from "../chroma";
import type { StellaConfig } from "../config";
import { defaultConfig } from "../config";
import type { VegapunkDatabase } from "../db";
import { createMcpRoutes } from "../mcp";
import { createErrorHandler } from "./error-handler";
import { ActivityStream, createActivityRoutes, createActivityStreamRoutes, createAgentsRoutes, createConfigRoutes, createKnowledgeRoutes, createTasksRoutes } from "./routes";

const dashboardHtml = readFileSync(new URL("../../public/index.html", import.meta.url), "utf8");

export type CreateAppOptions = {
  db: VegapunkDatabase;
  config?: StellaConfig;
  chromaClient?: ChromaGateway;
};

export function createApp({ db, config = defaultConfig, chromaClient }: CreateAppOptions) {
  const activityStream = new ActivityStream();

  return new Elysia()
    .decorate("db", db)
    .decorate("config", config)
    .use(staticPlugin({ assets: "public", prefix: "/public", silent: true }))
    .use(createAgentsRoutes(db, activityStream))
    .use(createTasksRoutes(db))
    .use(createActivityRoutes(db, activityStream))
    .use(createActivityStreamRoutes(activityStream))
    .use(createConfigRoutes(db, config))
    .use(createKnowledgeRoutes(db, chromaClient ? { chromaClient } : {}))
    .use(createMcpRoutes(db, chromaClient ? { chromaClient } : {}))
    .onError(createErrorHandler(config.nodeEnv))
    .get("/health", () => ({ ok: true, service: "stella" as const }))
    .get("/", ({ set }) => {
      set.headers["content-type"] = "text/html; charset=utf-8";

      return dashboardHtml;
    });
}

export type StellaApp = ReturnType<typeof createApp>;
