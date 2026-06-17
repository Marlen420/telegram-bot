import pg from 'pg';
import { config } from '../config';
import {
  Broadcast,
  BroadcastMessage,
  BroadcastMessagePayload,
  BroadcastMessageType,
  BroadcastSession,
  BroadcastSessionState,
} from './types';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

export async function initBroadcastsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS broadcasts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_by BIGINT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS broadcast_messages (
      id SERIAL PRIMARY KEY,
      broadcast_id INTEGER NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      message_type TEXT NOT NULL,
      payload JSONB NOT NULL,
      UNIQUE (broadcast_id, sort_order)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS broadcast_sessions (
      admin_telegram_id BIGINT PRIMARY KEY,
      state TEXT NOT NULL,
      draft_broadcast_id INTEGER REFERENCES broadcasts(id) ON DELETE CASCADE
    )
  `);
}

export async function listBroadcasts(): Promise<Broadcast[]> {
  const result = await pool.query<Broadcast>(`
    SELECT
      b.id,
      b.name,
      b.created_by,
      b.created_at,
      b.updated_at,
      COUNT(m.id)::int AS message_count
    FROM broadcasts b
    LEFT JOIN broadcast_messages m ON m.broadcast_id = b.id
    GROUP BY b.id
    ORDER BY b.updated_at DESC
  `);

  return result.rows.map((row) => ({
    ...row,
    message_count: Number(row.message_count ?? 0),
  }));
}

export async function getBroadcast(broadcastId: number): Promise<Broadcast | undefined> {
  const result = await pool.query<Broadcast>(
    `
    SELECT
      b.id,
      b.name,
      b.created_by,
      b.created_at,
      b.updated_at,
      COUNT(m.id)::int AS message_count
    FROM broadcasts b
    LEFT JOIN broadcast_messages m ON m.broadcast_id = b.id
    WHERE b.id = $1
    GROUP BY b.id
    `,
    [broadcastId],
  );

  const row = result.rows[0];
  if (!row) {
    return undefined;
  }

  return {
    ...row,
    message_count: Number(row.message_count ?? 0),
  };
}

export async function getBroadcastMessages(broadcastId: number): Promise<BroadcastMessage[]> {
  const result = await pool.query<{
    id: number;
    broadcast_id: number;
    sort_order: number;
    message_type: BroadcastMessageType;
    payload: BroadcastMessagePayload;
  }>(
    `
    SELECT id, broadcast_id, sort_order, message_type, payload
    FROM broadcast_messages
    WHERE broadcast_id = $1
    ORDER BY sort_order ASC
    `,
    [broadcastId],
  );

  return result.rows;
}

export async function createBroadcast(name: string, createdBy: number): Promise<Broadcast> {
  const result = await pool.query<Broadcast>(
    `
    INSERT INTO broadcasts (name, created_by)
    VALUES ($1, $2)
    RETURNING id, name, created_by, created_at, updated_at
    `,
    [name.trim(), createdBy],
  );

  const broadcast = result.rows[0];
  return { ...broadcast, message_count: 0 };
}

export async function deleteBroadcast(broadcastId: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM broadcasts WHERE id = $1', [broadcastId]);
  return (result.rowCount ?? 0) > 0;
}

export async function addBroadcastMessage(
  broadcastId: number,
  messageType: BroadcastMessageType,
  payload: BroadcastMessagePayload,
): Promise<BroadcastMessage> {
  const orderResult = await pool.query<{ next_order: number }>(
    `
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
    FROM broadcast_messages
    WHERE broadcast_id = $1
    `,
    [broadcastId],
  );

  const sortOrder = orderResult.rows[0]?.next_order ?? 1;

  const result = await pool.query<BroadcastMessage>(
    `
    INSERT INTO broadcast_messages (broadcast_id, sort_order, message_type, payload)
    VALUES ($1, $2, $3, $4::jsonb)
    RETURNING id, broadcast_id, sort_order, message_type, payload
    `,
    [broadcastId, sortOrder, messageType, JSON.stringify(payload)],
  );

  await pool.query('UPDATE broadcasts SET updated_at = NOW() WHERE id = $1', [broadcastId]);

  return result.rows[0];
}

export async function setBroadcastSession(
  adminTelegramId: number,
  state: BroadcastSessionState,
  draftBroadcastId: number | null,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO broadcast_sessions (admin_telegram_id, state, draft_broadcast_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (admin_telegram_id) DO UPDATE SET
      state = EXCLUDED.state,
      draft_broadcast_id = EXCLUDED.draft_broadcast_id
    `,
    [adminTelegramId, state, draftBroadcastId],
  );
}

export async function getBroadcastSession(
  adminTelegramId: number,
): Promise<BroadcastSession | undefined> {
  const result = await pool.query<BroadcastSession>(
    'SELECT admin_telegram_id, state, draft_broadcast_id FROM broadcast_sessions WHERE admin_telegram_id = $1',
    [adminTelegramId],
  );
  return result.rows[0];
}

export async function clearBroadcastSession(adminTelegramId: number): Promise<void> {
  await pool.query('DELETE FROM broadcast_sessions WHERE admin_telegram_id = $1', [adminTelegramId]);
}

export async function getBroadcastRecipientIds(): Promise<number[]> {
  const result = await pool.query<{ telegram_id: string }>(
    `
    SELECT telegram_id
    FROM users
    WHERE is_bot = false
      AND ($1::bigint IS NULL OR telegram_id <> $1)
    ORDER BY telegram_id ASC
    `,
    [config.forwardToChatId],
  );

  return result.rows.map((row) => Number(row.telegram_id));
}
