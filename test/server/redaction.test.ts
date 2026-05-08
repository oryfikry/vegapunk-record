import { describe, expect, test } from "bun:test";
import { createLogEntry, redact } from "../../src/security";

describe("safe redaction", () => {
  test("masks API keys, bearer tokens, cookies, SSH key headers, and env-style secrets", () => {
    const input = [
      "OPENAI_API_KEY=sk-liveSecret123",
      "CUSTOM_KEY=key-secretValue456",
      "Authorization: Bearer bearerSecret789",
      "Cookie: session=secret-cookie; other=value",
      "-----BEGIN OPENSSH PRIVATE KEY-----",
      "DATABASE_PASSWORD=super-secret-password",
    ].join("\n");

    const output = redact(input);

    expect(output).toContain("OPENAI_API_KEY=[REDACTED]");
    expect(output).toContain("CUSTOM_KEY=[REDACTED]");
    expect(output).toContain("Bearer [REDACTED]");
    expect(output).toContain("Cookie: [REDACTED]");
    expect(output).toContain("-----BEGIN [REDACTED] PRIVATE KEY-----");
    expect(output).toContain("DATABASE_PASSWORD=[REDACTED]");
    expect(output).not.toContain("sk-liveSecret123");
    expect(output).not.toContain("key-secretValue456");
    expect(output).not.toContain("bearerSecret789");
    expect(output).not.toContain("secret-cookie");
    expect(output).not.toContain("super-secret-password");
  });

  test("structured log entries redact secret-like fields and message content", () => {
    const entry = createLogEntry("info", "Using Bearer messageSecret", {
      apiKey: "sk-fieldSecret",
      nested: { cookie: "session=raw-cookie" },
      safe: "visible",
    });

    expect(entry).toContain('"level":"info"');
    expect(entry).toContain('"safe":"visible"');
    expect(entry).not.toContain("messageSecret");
    expect(entry).not.toContain("sk-fieldSecret");
    expect(entry).not.toContain("raw-cookie");
  });
});
