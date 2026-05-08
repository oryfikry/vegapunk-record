import type { Context } from "elysia";
import { log } from "../security";

const productionMode = "production";

type ErrorHandlerContext = {
  code?: string | number;
  error: unknown;
  set: Context["set"];
  request: Request;
};

function statusFromCode(code: string | number | undefined): number {
  if (typeof code === "number") {
    return code;
  }

  if (code === "NOT_FOUND") {
    return 404;
  }

  if (code === "VALIDATION") {
    return 400;
  }

  if (code === "PARSE") {
    return 400;
  }

  return 500;
}

function statusFromContext(setStatus: unknown, code: string | number | undefined): number {
  if (typeof setStatus === "number") {
    return setStatus;
  }

  return statusFromCode(code);
}

function safeErrorMessage(error: unknown, status: number, nodeEnv: string): string {
  if (status === 404) {
    return "Not Found";
  }

  if (status >= 500 && nodeEnv === productionMode) {
    return "Internal Server Error";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return status >= 500 ? "Internal Server Error" : "Bad Request";
}

export type JsonError = {
  error: string;
  status: number;
};

export function createErrorHandler(nodeEnv = Bun.env.NODE_ENV ?? "development") {
  return ({ code, error, set, request }: ErrorHandlerContext): JsonError => {
    const status = statusFromContext(set.status, code);
    const message = safeErrorMessage(error, status, nodeEnv);

    set.status = status;
    set.headers["content-type"] = "application/json";

    log("error", "Request failed", {
      status,
      code,
      method: request.method,
      url: request.url,
      error: message,
    });

    return { error: message, status };
  };
}
