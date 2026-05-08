export type LogLevel = "debug" | "info" | "warn" | "error";

const secretKeyPattern = /(?:SECRET|TOKEN|PASSWORD|PASS|API[_-]?KEY|PRIVATE[_-]?KEY|COOKIE|AUTH|CREDENTIAL|KEY)$/i;
const bearerPattern = /\bBearer\s+[^\s"']+/gi;
const cookiePattern = /\bCookie:\s*[^\r\n]+/gi;
const apiKeyPattern = /\b(?:sk|key)-[A-Za-z0-9][A-Za-z0-9._-]*/g;
const sshKeyHeaderPattern = /-----BEGIN\s+(?:OPENSSH|RSA|DSA|EC|ED25519)?\s*PRIVATE\s+KEY-----/gi;
const envSecretPattern = /^([A-Za-z_][A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASS|API[_-]?KEY|PRIVATE[_-]?KEY|COOKIE|AUTH|CREDENTIAL|KEY)[A-Za-z0-9_]*\s*=\s*)(.*)$/gim;

export function redact(input: string): string {
  return input
    .replace(sshKeyHeaderPattern, "-----BEGIN [REDACTED] PRIVATE KEY-----")
    .replace(cookiePattern, "Cookie: [REDACTED]")
    .replace(bearerPattern, "Bearer [REDACTED]")
    .replace(apiKeyPattern, "[REDACTED_API_KEY]")
    .replace(envSecretPattern, "$1[REDACTED]");
}

function redactUnknown(value: unknown): unknown {
  if (typeof value === "string") {
    return redact(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item));
  }

  if (value && typeof value === "object") {
    const redacted: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
      redacted[key] = secretKeyPattern.test(key) ? "[REDACTED]" : redactUnknown(child);
    }

    return redacted;
  }

  return value;
}

export type LogContext = Record<string, unknown>;

export function createLogEntry(level: LogLevel, message: string, context: LogContext = {}): string {
  const safeContext = redactUnknown(context) as LogContext;

  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message: redact(message),
    ...safeContext,
  });
}

export function log(level: LogLevel, message: string, context: LogContext = {}): void {
  const entry = createLogEntry(level, message, context);

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.log(entry);
}

