import type { Context } from "elysia";

const authTokenHeader = "x-stella-auth-token";

export function configuredAuthToken(): string | null {
  const token = Bun.env.STELLA_AUTH_TOKEN;
  return token && token.length > 0 ? token : null;
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function requireAuthToken(request: Request, set: Context["set"]): { error: string; status: 401 } | null {
  const token = configuredAuthToken();
  if (!token) {
    return null;
  }

  const supplied = request.headers.get(authTokenHeader) ?? bearerToken(request);
  if (supplied === token) {
    return null;
  }

  set.status = 401;
  return { error: "Unauthorized", status: 401 };
}
