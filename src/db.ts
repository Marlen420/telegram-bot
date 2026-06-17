import pg from 'pg';
import { CLICK_ACTIONS, ClickAction } from './clicks';
import { config } from './config';
import { TelegramUserInput } from './userTracking';

export interface User {
  telegram_id: number;
  chat_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  is_bot: boolean;
  is_premium: boolean;
  chat_type: string | null;
  phone: string | null;
  phone_shared_at: string | null;
  last_message_text: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

async function migrateUsersTable(): Promise<void> {
  const columns = [
    'chat_id BIGINT',
    'is_bot BOOLEAN DEFAULT false',
    'is_premium BOOLEAN DEFAULT false',
    'chat_type TEXT',
    'phone TEXT',
    'phone_shared_at TIMESTAMPTZ',
    'last_message_text TEXT',
  ];

  for (const column of columns) {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      chat_id BIGINT,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      language_code TEXT,
      is_bot BOOLEAN DEFAULT false,
      is_premium BOOLEAN DEFAULT false,
      chat_type TEXT,
      phone TEXT,
      phone_shared_at TIMESTAMPTZ,
      last_message_text TEXT,
      first_seen_at TIMESTAMPTZ NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL
    )
  `);

  await migrateUsersTable();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS button_clicks (
      telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      click_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (telegram_id, action)
    )
  `);
}

export async function saveUser(user: TelegramUserInput): Promise<User> {
  const now = new Date().toISOString();

  await pool.query(
    `
    INSERT INTO users (
      telegram_id, chat_id, username, first_name, last_name, language_code,
      is_bot, is_premium, chat_type, phone, phone_shared_at, last_message_text,
      first_seen_at, last_seen_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
    ON CONFLICT (telegram_id) DO UPDATE SET
      chat_id = EXCLUDED.chat_id,
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      language_code = EXCLUDED.language_code,
      is_bot = EXCLUDED.is_bot,
      is_premium = EXCLUDED.is_premium,
      chat_type = EXCLUDED.chat_type,
      phone = COALESCE(EXCLUDED.phone, users.phone),
      phone_shared_at = COALESCE(EXCLUDED.phone_shared_at, users.phone_shared_at),
      last_message_text = COALESCE(EXCLUDED.last_message_text, users.last_message_text),
      last_seen_at = EXCLUDED.last_seen_at
    `,
    [
      user.id,
      user.chat_id ?? user.id,
      user.username ?? null,
      user.first_name ?? null,
      user.last_name ?? null,
      user.language_code ?? null,
      user.is_bot ?? false,
      user.is_premium ?? false,
      user.chat_type ?? 'private',
      user.phone ?? null,
      user.phone_shared_at ?? null,
      user.last_message_text ?? null,
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

export interface UserStats {
  total: number;
  newToday: number;
  newWeek: number;
  activeToday: number;
  withPhone: number;
  premium: number;
}

export async function recordClick(telegramId: number, action: ClickAction): Promise<void> {
  await pool.query(
    `
    INSERT INTO button_clicks (telegram_id, action, click_count)
    VALUES ($1, $2, 1)
    ON CONFLICT (telegram_id, action) DO UPDATE SET
      click_count = button_clicks.click_count + 1
    `,
    [telegramId, action],
  );
}

export type ClickTotals = Record<ClickAction, number>;
export type UserClickMap = Record<number, Partial<Record<ClickAction, number>>>;

export async function getClickTotals(): Promise<ClickTotals> {
  const result = await pool.query<{ action: ClickAction; total: string }>(
    'SELECT action, SUM(click_count)::text AS total FROM button_clicks GROUP BY action',
  );

  const totals = Object.fromEntries(CLICK_ACTIONS.map((action) => [action, 0])) as ClickTotals;
  for (const row of result.rows) {
    if (CLICK_ACTIONS.includes(row.action)) {
      totals[row.action] = Number(row.total);
    }
  }
  return totals;
}

export async function getUserClickMap(): Promise<UserClickMap> {
  const result = await pool.query<{ telegram_id: string; action: ClickAction; click_count: number }>(
    'SELECT telegram_id, action, click_count FROM button_clicks',
  );

  const map: UserClickMap = {};
  for (const row of result.rows) {
    const userId = Number(row.telegram_id);
    if (!map[userId]) {
      map[userId] = {};
    }
    map[userId][row.action] = row.click_count;
  }
  return map;
}

export async function getUserStats(): Promise<UserStats> {
  const result = await pool.query<{
    total: string;
    new_today: string;
    new_week: string;
    active_today: string;
    with_phone: string;
    premium: string;
  }>(`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE first_seen_at >= CURRENT_DATE)::text AS new_today,
      COUNT(*) FILTER (WHERE first_seen_at >= CURRENT_DATE - INTERVAL '7 days')::text AS new_week,
      COUNT(*) FILTER (WHERE last_seen_at >= CURRENT_DATE)::text AS active_today,
      COUNT(*) FILTER (WHERE phone IS NOT NULL)::text AS with_phone,
      COUNT(*) FILTER (WHERE is_premium = true)::text AS premium
    FROM users
  `);

  const row = result.rows[0];
  return {
    total: Number(row?.total ?? 0),
    newToday: Number(row?.new_today ?? 0),
    newWeek: Number(row?.new_week ?? 0),
    activeToday: Number(row?.active_today ?? 0),
    withPhone: Number(row?.with_phone ?? 0),
    premium: Number(row?.premium ?? 0),
  };
}

export async function getAllUsers(): Promise<User[]> {
  const result = await pool.query<User>(
    'SELECT * FROM users ORDER BY last_seen_at DESC',
  );
  return result.rows;
}

export async function getUsersCount(): Promise<number> {
  const result = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  return Number(result.rows[0]?.count ?? 0);
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
