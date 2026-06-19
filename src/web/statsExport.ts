import { ACTION_LABELS, CLICK_ACTIONS, ClickAction } from '../clicks';
import { listBroadcasts } from '../broadcasts/repository';
import {
  ClickTotals,
  User,
  UserClickMap,
  UserStats,
  getAllUsers,
  getClickTotals,
  getUserClickMap,
  getUserStats,
} from '../db';
import { getAllPayments, getPaymentStats } from '../payments/repository';
import { Payment, PaymentStats } from '../payments/types';
import { Broadcast } from '../broadcasts/types';

export interface StatsExportData {
  stats: UserStats;
  users: User[];
  clickTotals: ClickTotals;
  userClicks: UserClickMap;
  paymentStats: PaymentStats;
  payments: Payment[];
  broadcasts: Broadcast[];
}

export interface StatsExportDocument {
  meta: {
    export_version: string;
    generated_at: string;
    source: string;
    description: string;
  };
  summary: {
    users: UserStats;
    clicks: {
      total: number;
      by_action: Record<ClickAction, number>;
    };
    payments: PaymentStats;
    broadcasts_count: number;
  };
  click_actions: Record<ClickAction, string>;
  users: Array<{
    telegram_id: number;
    chat_id: number | null;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    phone: string | null;
    language_code: string | null;
    is_premium: boolean;
    chat_type: string | null;
    last_message_text: string | null;
    first_seen_at: string;
    last_seen_at: string;
    clicks: Record<ClickAction, number>;
    total_clicks: number;
  }>;
  payments: Array<{
    id: number;
    telegram_id: number;
    fio: string;
    status: Payment['status'];
    ticket_count: number | null;
    confirmed_at: string | null;
    created_at: string;
  }>;
  broadcasts: Array<{
    id: number;
    name: string;
    message_count: number;
    created_at: string;
    updated_at: string;
  }>;
}

function displayName(user: User): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '';
}

function getUserClickCount(userClicks: UserClickMap, userId: number, action: ClickAction): number {
  return userClicks[userId]?.[action] ?? 0;
}

function getUserTotalClicks(userClicks: UserClickMap, userId: number): number {
  const clicks = userClicks[userId];
  if (!clicks) return 0;
  return CLICK_ACTIONS.reduce((sum, action) => sum + (clicks[action] ?? 0), 0);
}

export function buildStatsExport(data: StatsExportData): StatsExportDocument {
  const { stats, users, clickTotals, userClicks, paymentStats, payments, broadcasts } = data;
  const totalClicks = CLICK_ACTIONS.reduce((sum, action) => sum + clickTotals[action], 0);

  return {
    meta: {
      export_version: '1.0',
      generated_at: new Date().toISOString(),
      source: 'mingle-forum-telegram-bot',
      description:
        'Полная статистика бота Mingle Forum: пользователи, клики по кнопкам, оплаты и сохранённые рассылки.',
    },
    summary: {
      users: stats,
      clicks: {
        total: totalClicks,
        by_action: clickTotals,
      },
      payments: paymentStats,
      broadcasts_count: broadcasts.length,
    },
    click_actions: ACTION_LABELS,
    users: users.map((user) => {
      const clicks = Object.fromEntries(
        CLICK_ACTIONS.map((action) => [
          action,
          getUserClickCount(userClicks, user.telegram_id, action),
        ]),
      ) as Record<ClickAction, number>;

      return {
        telegram_id: user.telegram_id,
        chat_id: user.chat_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name: displayName(user) || null,
        phone: user.phone,
        language_code: user.language_code,
        is_premium: user.is_premium,
        chat_type: user.chat_type,
        last_message_text: user.last_message_text,
        first_seen_at: user.first_seen_at,
        last_seen_at: user.last_seen_at,
        clicks,
        total_clicks: getUserTotalClicks(userClicks, user.telegram_id),
      };
    }),
    payments: payments.map((payment) => ({
      id: payment.id,
      telegram_id: payment.telegram_id,
      fio: payment.fio,
      status: payment.status,
      ticket_count: payment.ticket_count,
      confirmed_at: payment.confirmed_at,
      created_at: payment.created_at,
    })),
    broadcasts: broadcasts.map((broadcast) => ({
      id: broadcast.id,
      name: broadcast.name,
      message_count: broadcast.message_count,
      created_at: broadcast.created_at,
      updated_at: broadcast.updated_at,
    })),
  };
}

export async function fetchStatsExportData(): Promise<StatsExportData> {
  const [stats, users, clickTotals, userClicks, paymentStats, payments, broadcasts] =
    await Promise.all([
      getUserStats(),
      getAllUsers(),
      getClickTotals(),
      getUserClickMap(),
      getPaymentStats(),
      getAllPayments(),
      listBroadcasts(),
    ]);

  return {
    stats,
    users,
    clickTotals,
    userClicks,
    paymentStats,
    payments,
    broadcasts,
  };
}

export function serializeStatsExport(data: StatsExportData): string {
  return JSON.stringify(buildStatsExport(data), null, 2);
}
