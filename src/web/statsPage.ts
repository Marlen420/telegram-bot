import { ACTION_LABELS, CLICK_ACTIONS, ClickAction } from '../clicks';
import { ClickTotals, User, UserClickMap, UserStats } from '../db';
import { Payment, PaymentStats } from '../payments/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayName(user: User): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '—';
}

function usernameCell(user: User): string {
  if (!user.username) return '—';
  return `@${escapeHtml(user.username)}`;
}

function truncate(value: string | null, max = 60): string {
  if (!value) return '—';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function boolLabel(value: boolean): string {
  return value ? 'Да' : 'Нет';
}

function getUserClickCount(userClicks: UserClickMap, userId: number, action: ClickAction): number {
  return userClicks[userId]?.[action] ?? 0;
}

function getUserTotalClicks(userClicks: UserClickMap, userId: number): number {
  const clicks = userClicks[userId];
  if (!clicks) return 0;
  return CLICK_ACTIONS.reduce((sum, action) => sum + (clicks[action] ?? 0), 0);
}

export interface StatsPageData {
  stats: UserStats;
  users: User[];
  clickTotals: ClickTotals;
  userClicks: UserClickMap;
  paymentStats: PaymentStats;
  recentPayments: Payment[];
}

function paymentStatusLabel(status: Payment['status']): string {
  return status === 'confirmed' ? 'Подтверждено' : 'Ожидает';
}

export function renderStatsPage(data: StatsPageData): string {
  const { stats, users, clickTotals, userClicks, paymentStats, recentPayments } = data;

  const clickCards = CLICK_ACTIONS.map(
    (action) => `
      <div class="card card-small">
        <div class="card-label">${escapeHtml(ACTION_LABELS[action])}</div>
        <div class="card-value card-value-small">${clickTotals[action]}</div>
      </div>`,
  ).join('');

  const clickHeaders = CLICK_ACTIONS.map(
    (action) => `<th>${escapeHtml(ACTION_LABELS[action])}</th>`,
  ).join('');

  const rows = users
    .map((user) => {
      const clickCells = CLICK_ACTIONS.map(
        (action) => `<td>${getUserClickCount(userClicks, user.telegram_id, action)}</td>`,
      ).join('');

      return `
        <tr>
          <td>${user.telegram_id}</td>
          <td>${user.chat_id ?? '—'}</td>
          <td>${escapeHtml(displayName(user))}</td>
          <td>${usernameCell(user)}</td>
          <td>${escapeHtml(user.phone ?? '—')}</td>
          <td>${escapeHtml(user.language_code ?? '—')}</td>
          <td>${boolLabel(user.is_premium)}</td>
          <td>${escapeHtml(user.chat_type ?? '—')}</td>
          <td class="wrap">${escapeHtml(truncate(user.last_message_text))}</td>
          ${clickCells}
          <td><strong>${getUserTotalClicks(userClicks, user.telegram_id)}</strong></td>
          <td>${formatDate(user.first_seen_at)}</td>
          <td>${formatDate(user.last_seen_at)}</td>
        </tr>`;
    })
    .join('');

  const totalClicks = CLICK_ACTIONS.reduce((sum, action) => sum + clickTotals[action], 0);

  const paymentRows = recentPayments
    .map(
      (payment) => `
        <tr>
          <td>#${payment.id}</td>
          <td>${payment.telegram_id}</td>
          <td>${escapeHtml(payment.fio)}</td>
          <td>${paymentStatusLabel(payment.status)}</td>
          <td>${payment.ticket_count ?? '—'}</td>
          <td>${formatDate(payment.created_at)}</td>
          <td>${payment.confirmed_at ? formatDate(payment.confirmed_at) : '—'}</td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mingle Forum Bot — Статистика</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f1117;
      color: #e8eaed;
      line-height: 1.5;
    }
    .wrap {
      max-width: 1400px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 1.75rem;
      font-weight: 700;
    }
    h2 {
      margin: 0 0 16px;
      font-size: 1.1rem;
      font-weight: 600;
      color: #e8eaed;
    }
    .subtitle {
      margin: 0 0 28px;
      color: #9aa0a6;
    }
    .section {
      margin-bottom: 32px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
    }
    .card {
      background: #1a1d27;
      border: 1px solid #2a2f3a;
      border-radius: 14px;
      padding: 20px;
    }
    .card-small {
      padding: 16px;
    }
    .card-label {
      font-size: 0.85rem;
      color: #9aa0a6;
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 2rem;
      font-weight: 700;
      color: #fff;
    }
    .card-value-small {
      font-size: 1.5rem;
    }
    .table-wrap {
      overflow-x: auto;
      background: #1a1d27;
      border: 1px solid #2a2f3a;
      border-radius: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92rem;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #2a2f3a;
      white-space: nowrap;
    }
    th {
      background: #141722;
      color: #9aa0a6;
      font-weight: 600;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #1f2330; }
    td.wrap {
      white-space: normal;
      max-width: 220px;
    }
    .empty {
      padding: 32px;
      text-align: center;
      color: #9aa0a6;
    }
    .footer {
      margin-top: 20px;
      font-size: 0.85rem;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Mingle Forum Bot</h1>
    <p class="subtitle">Статистика пользователей и кликов по кнопкам</p>

    <div class="section">
      <h2>Пользователи</h2>
      <div class="cards">
        <div class="card">
          <div class="card-label">Всего пользователей</div>
          <div class="card-value">${stats.total}</div>
        </div>
        <div class="card">
          <div class="card-label">Новых сегодня</div>
          <div class="card-value">${stats.newToday}</div>
        </div>
        <div class="card">
          <div class="card-label">Новых за 7 дней</div>
          <div class="card-value">${stats.newWeek}</div>
        </div>
        <div class="card">
          <div class="card-label">Активных сегодня</div>
          <div class="card-value">${stats.activeToday}</div>
        </div>
        <div class="card">
          <div class="card-label">С номером телефона</div>
          <div class="card-value">${stats.withPhone}</div>
        </div>
        <div class="card">
          <div class="card-label">Telegram Premium</div>
          <div class="card-value">${stats.premium}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Клики по кнопкам (всего: ${totalClicks})</h2>
      <div class="cards">${clickCards}</div>
    </div>

    <div class="section">
      <h2>Оплаты</h2>
      <div class="cards">
        <div class="card">
          <div class="card-label">Всего заявок</div>
          <div class="card-value">${paymentStats.total}</div>
        </div>
        <div class="card">
          <div class="card-label">Ожидают подтверждения</div>
          <div class="card-value">${paymentStats.pending}</div>
        </div>
        <div class="card">
          <div class="card-label">Подтверждено</div>
          <div class="card-value">${paymentStats.confirmed}</div>
        </div>
        <div class="card">
          <div class="card-label">Билетов продано</div>
          <div class="card-value">${paymentStats.ticketsSold}</div>
        </div>
      </div>
    </div>

    <div class="section table-wrap">
      ${
        recentPayments.length > 0
          ? `<h2 style="padding: 20px 20px 0; margin: 0;">Последние заявки на оплату</h2>
      <table>
        <thead>
          <tr>
            <th>№</th>
            <th>Telegram ID</th>
            <th>ФИО</th>
            <th>Статус</th>
            <th>Билетов</th>
            <th>Создана</th>
            <th>Подтверждена</th>
          </tr>
        </thead>
        <tbody>${paymentRows}</tbody>
      </table>`
          : ''
      }
    </div>

    <div class="section table-wrap">
      ${
        users.length > 0
          ? `<table>
        <thead>
          <tr>
            <th>Telegram ID</th>
            <th>Chat ID</th>
            <th>Имя</th>
            <th>Username</th>
            <th>Телефон</th>
            <th>Язык</th>
            <th>Premium</th>
            <th>Тип чата</th>
            <th>Последнее сообщение</th>
            ${clickHeaders}
            <th>Всего кликов</th>
            <th>Первый визит</th>
            <th>Последний визит</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`
          : '<div class="empty">Пользователей пока нет</div>'
      }
    </div>

    <p class="footer">Обновлено: ${formatDate(new Date().toISOString())}</p>
  </div>
</body>
</html>`;
}
