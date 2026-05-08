import { createDatabase } from "../src/db";
import { runSleepRoutine } from "../src/memory";

export async function runSleepScript(sqlitePath = Bun.env.SQLITE_PATH ?? "./data/punk-records.sqlite"): Promise<void> {
  const db = createDatabase(sqlitePath);

  try {
    const result = await runSleepRoutine(db, {
      flushEphemeral: Bun.env.SLEEP_FLUSH_EPHEMERAL === "1" || Bun.env.SLEEP_FLUSH_EPHEMERAL === "true",
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    db.close();
  }
}

if (import.meta.main) {
  try {
    await runSleepScript();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ ok: false, error: message }, null, 2));
    process.exit(1);
  }
}
