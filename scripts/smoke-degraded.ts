import { runDegradedSmoke } from "./smoke";

const evidence = await runDegradedSmoke();
console.log(JSON.stringify({ ok: true, evidence: ".sisyphus/evidence/task-12-degraded.json", degraded: evidence }, null, 2));
