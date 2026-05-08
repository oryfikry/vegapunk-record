import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Elysia } from "elysia";
import type { VegapunkDatabase } from "../db";
import { registerMcpTools } from "./tools";

const allowedHostnames = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

function getHostnameFromHeader(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (value.startsWith("[")) {
    const closingBracket = value.indexOf("]");
    return closingBracket === -1 ? value : value.slice(0, closingBracket + 1);
  }

  return value.split(":")[0] ?? value;
}

function isAllowedLocalUrl(value: string | null): boolean {
  if (!value) {
    return true;
  }

  try {
    return allowedHostnames.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function isLocalMcpRequest(request: Request): boolean {
  const host = getHostnameFromHeader(request.headers.get("host"));
  if (!host || !allowedHostnames.has(host)) {
    return false;
  }

  return isAllowedLocalUrl(request.headers.get("origin"));
}

export function createMcpServer(db: VegapunkDatabase): McpServer {
  const server = new McpServer({ name: "vegapunk-record", version: "0.1.0" });
  registerMcpTools(server, db);
  return server;
}

export function createMcpRoutes(db: VegapunkDatabase) {
  return new Elysia()
    .all("/mcp", async ({ request }) => {
      if (!isLocalMcpRequest(request)) {
        return new Response(JSON.stringify({ error: "MCP endpoint only accepts localhost Host and Origin headers" }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }

      const server = createMcpServer(db);
      const transport = new WebStandardStreamableHTTPServerTransport({
        enableJsonResponse: true,
      });

      await server.connect(transport);
      const response = await transport.handleRequest(request);
      await server.close();
      return response;
    });
}
