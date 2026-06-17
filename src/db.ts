import pg from 'pg';
import { config } from './config';

export interface User {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

export interface TelegramUserInput {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
}

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      language_code TEXT,
      first_seen_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL
    )
  `);
}

export async function saveUser(user: TelegramUserInput): Promise<User> {
  const now = new Date().toISOString();

  await pool.query(
    `
    INSERT INTO users (telegram_id, username, first_name, last_name, language_code, first_seen_at, last_seen_at)
    VALUES ($1, $2, $3, $4, $5, $6, $6)
    ON CONFLICT (telegram_id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      language_code = EXCLUDED.language_code,
      last_seen_at = EXCLUDED.last_seen_at
    `,
    [
      user.id,
      user.username ?? null,
      user.first_name ?? null,
      user.last_name ?? null,
      user.language_code ?? null,
      now,
    ],
  );

  const saved = await getUser(user.id);
  if (!saved) {
    throw new Error(`Failed to save user ${user.id}`);
  }
  return saved;
}

export async function getUser(telegramId: number): Promise<User | undefined> {
  const result = await pool.query<User>('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
  return result.rows[0];
}

export async function getUsersCount(): Promise<number> {
  const result = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  return Number(result.rows[0]?.count ?? 0);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
