import { nowIso, type NamedSqliteBindings, type SqliteDatabase } from "./shared";

export type Config = {
  key: string;
  value: string;
  type: string;
  is_secret: number;
  updated_at: string;
};

export type SetConfigInput = {
  key: string;
  value: string;
  type: string;
  is_secret?: boolean;
};

export function createConfigsRepository(db: SqliteDatabase) {
  return {
    get(key: string): Config | null {
      return db.query<Config, [string]>("SELECT * FROM configs WHERE key = ?").get(key);
    },

    list(): Config[] {
      return db.query<Config, []>("SELECT * FROM configs ORDER BY key").all();
    },

    set(input: SetConfigInput): Config {
      return db.query<Config, NamedSqliteBindings>(`
        INSERT INTO configs (key, value, type, is_secret, updated_at)
        VALUES ($key, $value, $type, $is_secret, $updated_at)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          type = excluded.type,
          is_secret = excluded.is_secret,
          updated_at = excluded.updated_at
        RETURNING *
      `).get({
        $key: input.key,
        $value: input.value,
        $type: input.type,
        $is_secret: input.is_secret === true ? 1 : 0,
        $updated_at: nowIso(),
      }) as Config;
    },
  };
}
