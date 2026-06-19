import pg from 'pg';
import { config } from '../config';
import { Payment, PaymentStats } from './types';

const pool = new pg.Pool({
  connectionString: config.databaseUrl,
});

export async function initPaymentsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
      fio TEXT NOT NULL,
      receipt_file_id TEXT,
      receipt_kind TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      ticket_count INTEGER,
      confirmed_by BIGINT,
      confirmed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      admin_telegram_id BIGINT PRIMARY KEY,
      awaiting_payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE
    )
  `);
}

export async function createPayment(input: {
  telegramId: number;
  fio: string;
  receiptFileId: string;
  receiptKind: 'photo' | 'document';
}): Promise<Payment> {
  const result = await pool.query<Payment>(
    `
    INSERT INTO payments (telegram_id, fio, receipt_file_id, receipt_kind, status)
    VALUES ($1, $2, $3, $4, 'pending')
    RETURNING *
    `,
    [input.telegramId, input.fio, input.receiptFileId, input.receiptKind],
  );

  return result.rows[0];
}

export async function getPayment(paymentId: number): Promise<Payment | undefined> {
  const result = await pool.query<Payment>('SELECT * FROM payments WHERE id = $1', [paymentId]);
  return result.rows[0];
}

export async function confirmPayment(
  paymentId: number,
  ticketCount: number,
  adminTelegramId: number,
): Promise<Payment | undefined> {
  const result = await pool.query<Payment>(
    `
    UPDATE payments
    SET
      status = 'confirmed',
      ticket_count = $2,
      confirmed_by = $3,
      confirmed_at = NOW()
    WHERE id = $1 AND status = 'pending'
    RETURNING *
    `,
    [paymentId, ticketCount, adminTelegramId],
  );

  return result.rows[0];
}

export async function setAdminAwaitingPayment(
  adminTelegramId: number,
  paymentId: number,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO admin_sessions (admin_telegram_id, awaiting_payment_id)
    VALUES ($1, $2)
    ON CONFLICT (admin_telegram_id) DO UPDATE SET
      awaiting_payment_id = EXCLUDED.awaiting_payment_id
    `,
    [adminTelegramId, paymentId],
  );
}

export async function clearAdminSession(adminTelegramId: number): Promise<void> {
  await pool.query('DELETE FROM admin_sessions WHERE admin_telegram_id = $1', [adminTelegramId]);
}

export async function getAdminAwaitingPaymentId(
  adminTelegramId: number,
): Promise<number | undefined> {
  const result = await pool.query<{ awaiting_payment_id: number }>(
    'SELECT awaiting_payment_id FROM admin_sessions WHERE admin_telegram_id = $1',
    [adminTelegramId],
  );
  return result.rows[0]?.awaiting_payment_id;
}

export async function getPaymentStats(): Promise<PaymentStats> {
  const result = await pool.query<{
    total: string;
    pending: string;
    confirmed: string;
    tickets_sold: string;
  }>(`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'pending')::text AS pending,
      COUNT(*) FILTER (WHERE status = 'confirmed')::text AS confirmed,
      COALESCE(SUM(ticket_count) FILTER (WHERE status = 'confirmed'), 0)::text AS tickets_sold
    FROM payments
  `);

  const row = result.rows[0];
  return {
    total: Number(row?.total ?? 0),
    pending: Number(row?.pending ?? 0),
    confirmed: Number(row?.confirmed ?? 0),
    ticketsSold: Number(row?.tickets_sold ?? 0),
  };
}

export async function getRecentPayments(limit = 50): Promise<Payment[]> {
  const result = await pool.query<Payment>(
    'SELECT * FROM payments ORDER BY created_at DESC LIMIT $1',
    [limit],
  );
  return result.rows;
}

export async function getAllPayments(): Promise<Payment[]> {
  const result = await pool.query<Payment>('SELECT * FROM payments ORDER BY created_at DESC');
  return result.rows;
}

export async function getConfirmedTicketsByUser(): Promise<
  Array<{ telegram_id: number; tickets: string }>
> {
  const result = await pool.query<{ telegram_id: string; tickets: string }>(`
    SELECT telegram_id, COALESCE(SUM(ticket_count), 0)::text AS tickets
    FROM payments
    WHERE status = 'confirmed'
    GROUP BY telegram_id
  `);
  return result.rows.map((row) => ({
    telegram_id: Number(row.telegram_id),
    tickets: row.tickets,
  }));
}
