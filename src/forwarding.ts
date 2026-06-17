import { Context, Markup, Telegraf } from 'telegraf';
import { config } from './config';
import { User } from './db';

export function formatSenderInfo(ctx: Context): string {
  const user = ctx.from;
  if (!user) {
    return 'От: неизвестный пользователь';
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || '—';
  const username = user.username ? `@${user.username}` : 'без username';

  return `От: ${fullName}\nUsername: ${username}\nTelegram ID: ${user.id}`;
}

function buildContactKeyboard(ctx: Context) {
  const user = ctx.from;
  if (!user) {
    return undefined;
  }

  const buttons = [
    Markup.button.url('💬 Написать пользователю', `tg://user?id=${user.id}`),
  ];

  if (user.username) {
    buttons.push(Markup.button.url(`📱 @${user.username}`, `https://t.me/${user.username}`));
  }

  return Markup.inlineKeyboard(buttons);
}

export function isPdfDocument(document: {
  mime_type?: string;
  file_name?: string;
}): boolean {
  if (document.mime_type === 'application/pdf') {
    return true;
  }
  return document.file_name?.toLowerCase().endsWith('.pdf') ?? false;
}

async function sendToAdmin(
  bot: Telegraf,
  ctx: Context,
  caption: string,
  sendFile: (chatId: number) => Promise<unknown>,
): Promise<void> {
  if (!config.forwardToChatId) {
    console.warn('FORWARD_TO_CHAT_ID is not set, message was not forwarded');
    return;
  }

  const keyboard = buildContactKeyboard(ctx);

  await bot.telegram.sendMessage(config.forwardToChatId, caption, keyboard);
  await sendFile(config.forwardToChatId);
}

export async function forwardPhotoToAdmin(
  ctx: Context,
  bot: Telegraf,
  captionPrefix: string,
  fileId: string,
): Promise<void> {
  const caption = `${captionPrefix}\n\n${formatSenderInfo(ctx)}`;
  await sendToAdmin(bot, ctx, caption, (chatId) => bot.telegram.sendPhoto(chatId, fileId));
}

export async function forwardPdfToAdmin(
  ctx: Context,
  bot: Telegraf,
  captionPrefix: string,
  fileId: string,
): Promise<void> {
  const caption = `${captionPrefix}\n\n${formatSenderInfo(ctx)}`;
  await sendToAdmin(bot, ctx, caption, (chatId) => bot.telegram.sendDocument(chatId, fileId));
}

export async function forwardPaymentToAdmin(
  ctx: Context,
  bot: Telegraf,
  user: User,
): Promise<void> {
  if (!user.pending_receipt_file_id || !user.pending_fio) {
    return;
  }

  const caption = [
    'Оплата Mingle Forum',
    formatSenderInfo(ctx),
    `ФИО: ${user.pending_fio}`,
    '',
    'Нажмите кнопку ниже, чтобы написать пользователю.',
  ].join('\n');

  if (!config.forwardToChatId) {
    console.warn('FORWARD_TO_CHAT_ID is not set, payment was not forwarded');
    return;
  }

  const keyboard = buildContactKeyboard(ctx);
  await bot.telegram.sendMessage(config.forwardToChatId, caption, keyboard);

  if (user.pending_receipt_kind === 'photo') {
    await bot.telegram.sendPhoto(config.forwardToChatId, user.pending_receipt_file_id, {
      caption: 'Чек об оплате',
    });
  } else {
    await bot.telegram.sendDocument(config.forwardToChatId, user.pending_receipt_file_id, {
      caption: 'Чек об оплате',
    });
  }
}
