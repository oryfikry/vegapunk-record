import { describeScaffold, localDefaults } from "../src/index";

console.log(describeScaffold());
console.log(`Stella placeholder would bind to ${localDefaults.host}:${localDefaults.port}.`);
console.log("No server, database, Chroma, MCP, or real LLM provider is started by this placeholder.");
