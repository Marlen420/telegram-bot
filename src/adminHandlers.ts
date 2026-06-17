import { Context, Markup, Telegraf } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/types';
import { config } from './config';
import { getUser } from './db';
import {
  clearAdminSession,
  confirmPayment,
  getAdminAwaitingPaymentId,
  getPayment,
  setAdminAwaitingPayment,
} from './payments/repository';
import { Payment } from './payments/types';

export function isPaymentAdmin(ctx: Context): boolean {
  return Boolean(config.forwardToChatId && ctx.from?.id === config.forwardToChatId);
}

function buildContactButtons(ctx: Context) {
  const user = ctx.from;
  if (!user) {
    return [];
  }

  const buttons = [Markup.button.url('💬 Написать пользователю', `tg://user?id=${user.id}`)];
  if (user.username) {
    buttons.push(Markup.button.url(`📱 @${user.username}`, `https://t.me/${user.username}`));
  }
  return buttons;
}

export function buildPaymentAdminKeyboard(paymentId: number, payerCtx: Context) {
  const payer = payerCtx.from;
  const contactRow = payer ? buildContactButtons(payerCtx) : [];

  const rows: InlineKeyboardButton[][] = [
    [Markup.button.callback('✅ Подтвердить 1 билет', `pc:${paymentId}:1`)],
    [Markup.button.callback('✏️ Указать количество билетов', `pcu:${paymentId}`)],
  ];

  if (contactRow.length > 0) {
    rows.push(contactRow);
  }

  return Markup.inlineKeyboard(rows);
}

function formatPaymentStatus(payment: Payment, payerUsername: string | null): string {
  const username = payerUsername ? `@${payerUsername}` : 'без username';
  const statusLine =
    payment.status === 'confirmed'
      ? `✅ Подтверждено: ${payment.ticket_count} билет(ов)`
      : '⏳ Ожидает подтверждения';

  return [
    'Оплата Mingle Forum',
    `Заявка #${payment.id}`,
    statusLine,
    `Пользователь: ${username}`,
    `Telegram ID: ${payment.telegram_id}`,
    `ФИО: ${payment.fio}`,
  ].join('\n');
}

async function notifyPayer(bot: Telegraf, payment: Payment): Promise<void> {
  const ticketWord =
    payment.ticket_count === 1
      ? '1 билет'
      : `${payment.ticket_count} билета`;

  await bot.telegram.sendMessage(
    payment.telegram_id,
    `✅ Ваша оплата подтверждена.\n\nКоличество билетов: ${ticketWord}.\nСпасибо!`,
  );
}

async function finalizeConfirmation(
  bot: Telegraf,
  ctx: Context,
  payment: Payment,
  ticketCount: number,
): Promise<void> {
  const payer = await getUser(payment.telegram_id);
  const statusText = formatPaymentStatus(
    { ...payment, status: 'confirmed', ticket_count: ticketCount },
    payer?.username ?? null,
  );

  if (ctx.callbackQuery?.message && 'message_id' in ctx.callbackQuery.message) {
    await ctx.editMessageText(statusText);
  } else {
    await ctx.reply(statusText);
  }

  await notifyPayer(bot, { ...payment, ticket_count: ticketCount });
  await clearAdminSession(ctx.from!.id);
}

export async function handleConfirmPaymentCallback(
  ctx: Context,
  bot: Telegraf,
  paymentId: number,
  ticketCount: number,
): Promise<void> {
  if (!isPaymentAdmin(ctx)) {
    await ctx.answerCbQuery('Недостаточно прав');
    return;
  }

  const payment = await getPayment(paymentId);
  if (!payment) {
    await ctx.answerCbQuery('Заявка не найдена');
    return;
  }

  if (payment.status === 'confirmed') {
    await ctx.answerCbQuery('Уже подтверждено');
    return;
  }

  if (ticketCount < 1 || ticketCount > 100) {
    await ctx.answerCbQuery('Количество должно быть от 1 до 100');
    return;
  }

  const confirmed = await confirmPayment(paymentId, ticketCount, ctx.from!.id);
  if (!confirmed) {
    await ctx.answerCbQuery('Не удалось подтвердить');
    return;
  }

  await ctx.answerCbQuery(`Подтверждено: ${ticketCount} билет(ов)`);
  await finalizeConfirmation(bot, ctx, confirmed, ticketCount);
}

export async function handleCustomCountCallback(
  ctx: Context,
  paymentId: number,
): Promise<void> {
  if (!isPaymentAdmin(ctx)) {
    await ctx.answerCbQuery('Недостаточно прав');
    return;
  }

  const payment = await getPayment(paymentId);
  if (!payment) {
    await ctx.answerCbQuery('Заявка не найдена');
    return;
  }

  if (payment.status === 'confirmed') {
    await ctx.answerCbQuery('Уже подтверждено');
    return;
  }

  await setAdminAwaitingPayment(ctx.from!.id, paymentId);
  await ctx.answerCbQuery();
  await ctx.reply(
    `Введите количество билетов для заявки #${paymentId}.\nНапример: 3`,
  );
}

export async function handleAdminTicketCountText(
  ctx: Context,
  bot: Telegraf,
  text: string,
): Promise<boolean> {
  if (!isPaymentAdmin(ctx)) {
    return false;
  }

  const paymentId = await getAdminAwaitingPaymentId(ctx.from!.id);
  if (!paymentId) {
    return false;
  }

  const count = Number.parseInt(text.trim(), 10);
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    await ctx.reply('Введите целое число от 1 до 100.');
    return true;
  }

  const payment = await getPayment(paymentId);
  if (!payment || payment.status === 'confirmed') {
    await clearAdminSession(ctx.from!.id);
    await ctx.reply('Заявка уже обработана или не найдена.');
    return true;
  }

  const confirmed = await confirmPayment(paymentId, count, ctx.from!.id);
  if (!confirmed) {
    await ctx.reply('Не удалось подтвердить оплату.');
    return true;
  }

  await ctx.reply(`✅ Заявка #${paymentId} подтверждена: ${count} билет(ов).`);
  await notifyPayer(bot, confirmed);
  await clearAdminSession(ctx.from!.id);
  return true;
}

export function registerAdminHandlers(bot: Telegraf<Context>): void {
  bot.action(/^pc:(\d+):(\d+)$/, async (ctx) => {
    const paymentId = Number(ctx.match[1]);
    const ticketCount = Number(ctx.match[2]);
    await handleConfirmPaymentCallback(ctx, bot, paymentId, ticketCount);
  });

  bot.action(/^pcu:(\d+)$/, async (ctx) => {
    const paymentId = Number(ctx.match[1]);
    await handleCustomCountCallback(ctx, paymentId);
  });
}
