import { Context, Markup, Telegraf } from 'telegraf';
import { InlineKeyboardButton } from 'telegraf/types';
import { isPaymentAdmin } from '../adminHandlers';
import {
  addBroadcastMessage,
  clearBroadcastSession,
  createBroadcast,
  deleteBroadcast,
  getBroadcast,
  getBroadcastMessages,
  getBroadcastRecipientIds,
  getBroadcastSession,
  listBroadcasts,
  setBroadcastSession,
} from './repository';
import { sendBroadcastToAllUsers } from './sender';
import { BroadcastMessagePayload, BroadcastMessageType } from './types';

const MESSAGE_TYPE_LABELS: Record<BroadcastMessageType, string> = {
  text: 'текст',
  photo: 'фото',
  video: 'видео',
  video_note: 'кружок',
  document: 'файл',
  voice: 'голосовое',
  audio: 'аудио',
  animation: 'GIF',
  sticker: 'стикер',
};

function composeKeyboard(): ReturnType<typeof Markup.inlineKeyboard> {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Сохранить рассылку', 'bc:done')],
    [Markup.button.callback('❌ Отменить', 'bc:cancel')],
  ]);
}

async function openBroadcastMenu(ctx: Context): Promise<void> {
  await clearBroadcastSession(ctx.from!.id);
  await showBroadcastMenu(ctx);
}

function menuKeyboard(broadcasts: Awaited<ReturnType<typeof listBroadcasts>>) {
  const rows: InlineKeyboardButton[][] = broadcasts.map((broadcast) => [
    Markup.button.callback(
      `${broadcast.name} (${broadcast.message_count})`,
      `bc:view:${broadcast.id}`,
    ),
  ]);

  rows.push([Markup.button.callback('➕ Добавить новую рассылку', 'bc:new')]);

  return Markup.inlineKeyboard(rows);
}

function broadcastActionsKeyboard(broadcastId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📤 Отправить всем', `bc:send:${broadcastId}`)],
    [Markup.button.callback('🗑 Удалить', `bc:delete:${broadcastId}`)],
    [Markup.button.callback('◀️ К списку', 'bc:menu')],
  ]);
}

function confirmSendKeyboard(broadcastId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Да, отправить', `bc:send_confirm:${broadcastId}`)],
    [Markup.button.callback('◀️ Назад', `bc:view:${broadcastId}`)],
  ]);
}

function confirmDeleteKeyboard(broadcastId: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🗑 Да, удалить', `bc:delete_confirm:${broadcastId}`)],
    [Markup.button.callback('◀️ Назад', `bc:view:${broadcastId}`)],
  ]);
}

function formatBroadcastDetails(
  broadcast: NonNullable<Awaited<ReturnType<typeof getBroadcast>>>,
  messages: Awaited<ReturnType<typeof getBroadcastMessages>>,
): string {
  const lines = [
    `📋 Рассылка: ${broadcast.name}`,
    `Сообщений: ${broadcast.message_count}`,
    '',
  ];

  if (messages.length === 0) {
    lines.push('Сообщений пока нет.');
    return lines.join('\n');
  }

  lines.push('Состав:');
  for (const [index, message] of messages.entries()) {
    const label = MESSAGE_TYPE_LABELS[message.message_type] ?? message.message_type;
    const preview =
      message.message_type === 'text'
        ? (message.payload.text ?? '').slice(0, 40)
        : (message.payload.caption ?? '').slice(0, 40);
    const suffix = preview ? ` — ${preview}${preview.length >= 40 ? '…' : ''}` : '';
    lines.push(`${index + 1}. ${label}${suffix}`);
  }

  return lines.join('\n');
}

export function extractBroadcastMessage(
  ctx: Context,
): { type: BroadcastMessageType; payload: BroadcastMessagePayload } | null {
  const msg = ctx.message;
  if (!msg) {
    return null;
  }

  if ('text' in msg && msg.text) {
    return { type: 'text', payload: { text: msg.text } };
  }

  if ('photo' in msg && msg.photo?.length) {
    const photo = msg.photo[msg.photo.length - 1];
    return {
      type: 'photo',
      payload: { file_id: photo.file_id, caption: msg.caption },
    };
  }

  if ('video' in msg && msg.video) {
    return {
      type: 'video',
      payload: { file_id: msg.video.file_id, caption: msg.caption },
    };
  }

  if ('video_note' in msg && msg.video_note) {
    return { type: 'video_note', payload: { file_id: msg.video_note.file_id } };
  }

  if ('document' in msg && msg.document) {
    return {
      type: 'document',
      payload: { file_id: msg.document.file_id, caption: msg.caption },
    };
  }

  if ('voice' in msg && msg.voice) {
    return {
      type: 'voice',
      payload: { file_id: msg.voice.file_id, caption: msg.caption },
    };
  }

  if ('audio' in msg && msg.audio) {
    return {
      type: 'audio',
      payload: { file_id: msg.audio.file_id, caption: msg.caption },
    };
  }

  if ('animation' in msg && msg.animation) {
    return {
      type: 'animation',
      payload: { file_id: msg.animation.file_id, caption: msg.caption },
    };
  }

  if ('sticker' in msg && msg.sticker) {
    return { type: 'sticker', payload: { file_id: msg.sticker.file_id } };
  }

  return null;
}

export async function showBroadcastMenu(ctx: Context): Promise<void> {
  const broadcasts = await listBroadcasts();
  const recipientCount = (await getBroadcastRecipientIds()).length;

  const text = [
    '📣 Рассылки',
    `Получателей в базе: ${recipientCount}`,
    '',
    broadcasts.length > 0
      ? 'Выберите рассылку или создайте новую:'
      : 'Сохранённых рассылок пока нет. Создайте первую:',
  ].join('\n');

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, menuKeyboard(broadcasts));
    await ctx.answerCbQuery();
    return;
  }

  await ctx.reply(text, menuKeyboard(broadcasts));
}

async function startNewBroadcast(ctx: Context): Promise<void> {
  await setBroadcastSession(ctx.from!.id, 'awaiting_name', null);
  await ctx.answerCbQuery();
  await ctx.reply('Введите название новой рассылки:');
}

async function finishComposing(ctx: Context, broadcastId: number): Promise<void> {
  const broadcast = await getBroadcast(broadcastId);
  if (!broadcast) {
    await clearBroadcastSession(ctx.from!.id);
    await ctx.reply('Рассылка не найдена.');
    return;
  }

  if (broadcast.message_count === 0) {
    await ctx.reply('Добавьте хотя бы одно сообщение перед сохранением.');
    return;
  }

  await clearBroadcastSession(ctx.from!.id);
  await ctx.reply(
    `✅ Рассылка «${broadcast.name}» сохранена (${broadcast.message_count} сообщ.).`,
    broadcastActionsKeyboard(broadcast.id),
  );
}

async function cancelComposing(ctx: Context): Promise<void> {
  const session = await getBroadcastSession(ctx.from!.id);
  await clearBroadcastSession(ctx.from!.id);

  if (session?.draft_broadcast_id) {
    await deleteBroadcast(session.draft_broadcast_id);
  }

  await ctx.answerCbQuery('Отменено');
  await showBroadcastMenu(ctx);
}

async function viewBroadcast(ctx: Context, broadcastId: number): Promise<void> {
  const broadcast = await getBroadcast(broadcastId);
  if (!broadcast) {
    await ctx.answerCbQuery('Рассылка не найдена');
    return;
  }

  const messages = await getBroadcastMessages(broadcastId);
  const text = formatBroadcastDetails(broadcast, messages);

  await ctx.editMessageText(text, broadcastActionsKeyboard(broadcastId));
  await ctx.answerCbQuery();
}

async function promptSendBroadcast(ctx: Context, broadcastId: number): Promise<void> {
  const broadcast = await getBroadcast(broadcastId);
  if (!broadcast) {
    await ctx.answerCbQuery('Рассылка не найдена');
    return;
  }

  if (broadcast.message_count === 0) {
    await ctx.answerCbQuery('В рассылке нет сообщений');
    return;
  }

  const recipientCount = (await getBroadcastRecipientIds()).length;
  await ctx.editMessageText(
    `Отправить рассылку «${broadcast.name}»?\n\nСообщений: ${broadcast.message_count}\nПолучателей: ${recipientCount}`,
    confirmSendKeyboard(broadcastId),
  );
  await ctx.answerCbQuery();
}

async function executeSendBroadcast(ctx: Context, bot: Telegraf, broadcastId: number): Promise<void> {
  const broadcast = await getBroadcast(broadcastId);
  if (!broadcast) {
    await ctx.answerCbQuery('Рассылка не найдена');
    return;
  }

  const messages = await getBroadcastMessages(broadcastId);
  if (messages.length === 0) {
    await ctx.answerCbQuery('В рассылке нет сообщений');
    return;
  }

  const recipientIds = await getBroadcastRecipientIds();
  await ctx.answerCbQuery('Рассылка запущена…');
  await ctx.editMessageText(
    `⏳ Отправляем «${broadcast.name}»…\nПолучателей: ${recipientIds.length}`,
  );

  const result = await sendBroadcastToAllUsers(bot, recipientIds, messages);

  await ctx.reply(
    [
      `✅ Рассылка «${broadcast.name}» завершена.`,
      `Доставлено: ${result.sent}`,
      `Не доставлено: ${result.failed}`,
    ].join('\n'),
    broadcastActionsKeyboard(broadcastId),
  );
}

async function promptDeleteBroadcast(ctx: Context, broadcastId: number): Promise<void> {
  const broadcast = await getBroadcast(broadcastId);
  if (!broadcast) {
    await ctx.answerCbQuery('Рассылка не найдена');
    return;
  }

  await ctx.editMessageText(
    `Удалить рассылку «${broadcast.name}»?\nЭто действие нельзя отменить.`,
    confirmDeleteKeyboard(broadcastId),
  );
  await ctx.answerCbQuery();
}

async function executeDeleteBroadcast(ctx: Context, broadcastId: number): Promise<void> {
  const broadcast = await getBroadcast(broadcastId);
  if (!broadcast) {
    await ctx.answerCbQuery('Рассылка не найдена');
    return;
  }

  await deleteBroadcast(broadcastId);
  await ctx.answerCbQuery('Удалено');
  await showBroadcastMenu(ctx);
}

async function appendMessageToDraft(ctx: Context, broadcastId: number): Promise<boolean> {
  const extracted = extractBroadcastMessage(ctx);
  if (!extracted) {
    await ctx.reply('Этот тип сообщения не поддерживается. Отправьте текст, фото, видео, кружок или файл.');
    return true;
  }

  const saved = await addBroadcastMessage(broadcastId, extracted.type, extracted.payload);
  const label = MESSAGE_TYPE_LABELS[saved.message_type] ?? saved.message_type;
  const broadcast = await getBroadcast(broadcastId);

  await ctx.reply(
    `Добавлено: ${label}. Всего сообщений: ${broadcast?.message_count ?? 0}.\n\nМожно отправить ещё или нажать «Сохранить рассылку».`,
    composeKeyboard(),
  );
  return true;
}

export async function handleBroadcastAdminText(ctx: Context, text: string): Promise<boolean> {
  if (!isPaymentAdmin(ctx)) {
    return false;
  }

  const session = await getBroadcastSession(ctx.from!.id);
  if (!session) {
    return false;
  }

  if (session.state === 'awaiting_name') {
    const name = text.trim();
    if (name.length < 2) {
      await ctx.reply('Название должно быть не короче 2 символов.');
      return true;
    }

    const broadcast = await createBroadcast(name, ctx.from!.id);
    await setBroadcastSession(ctx.from!.id, 'composing', broadcast.id);
    await ctx.reply(
      `Рассылка «${broadcast.name}» создана.\n\nОтправляйте сообщения по одному: текст, фото, видео, кружки, файлы.\nКогда закончите — нажмите «Сохранить рассылку».`,
      composeKeyboard(),
    );
    return true;
  }

  if (session.state === 'composing' && session.draft_broadcast_id) {
    return appendMessageToDraft(ctx, session.draft_broadcast_id);
  }

  return false;
}

export async function handleBroadcastAdminMessage(ctx: Context): Promise<boolean> {
  if (!isPaymentAdmin(ctx)) {
    return false;
  }

  const session = await getBroadcastSession(ctx.from!.id);
  if (!session || session.state !== 'composing' || !session.draft_broadcast_id) {
    return false;
  }

  return appendMessageToDraft(ctx, session.draft_broadcast_id);
}

export function registerBroadcastHandlers(bot: Telegraf<Context>): void {
  const openMenu = async (ctx: Context) => {
    if (!isPaymentAdmin(ctx)) {
      return;
    }
    await openBroadcastMenu(ctx);
  };

  bot.command(['broadcast', 'рассылка'], openMenu);
  bot.hears('📣 Рассылки', openMenu);

  bot.action('bc:menu', async (ctx) => {
    if (!isPaymentAdmin(ctx)) {
      await ctx.answerCbQuery('Недостаточно прав');
      return;
    }
    await openBroadcastMenu(ctx);
  });

  bot.action('bc:new', async (ctx) => {
    if (!isPaymentAdmin(ctx)) {
      await ctx.answerCbQuery('Недостаточно прав');
      return;
    }
    await startNewBroadcast(ctx);
  });

  bot.action('bc:done', async (ctx) => {
    if (!isPaymentAdmin(ctx)) {
      await ctx.answerCbQuery('Недостаточно прав');
      return;
    }

    const session = await getBroadcastSession(ctx.from!.id);
    if (!session?.draft_broadcast_id) {
      await ctx.answerCbQuery('Нет активной рассылки');
      return;
    }

    await ctx.answerCbQuery();
    await finishComposing(ctx, session.draft_broadcast_id);
  });

  bot.action('bc:cancel', async (ctx) => {
    if (!isPaymentAdmin(ctx)) {
      await ctx.answerCbQuery('Недостаточно прав');
      return;
    }
    await cancelComposing(ctx);
  });

  bot.action(/^bc:view:(\d+)$/, async (ctx) => {
    if (!isPaymentAdmin(ctx)) {
      await ctx.answerCbQuery('Недостаточно прав');
      return;
    }
    await viewBroadcast(ctx, Number(ctx.match[1]));
  });

  bot.action(/^bc:send:(\d+)$/, async (ctx) => {
    if (!isPaymentAdmin(ctx)) {
      await ctx.answerCbQuery('Недостаточно прав');
      return;
    }
    await promptSendBroadcast(ctx, Number(ctx.match[1]));
  });

  bot.action(/^bc:send_confirm:(\d+)$/, async (ctx) => {
    if (!isPaymentAdmin(ctx)) {
      await ctx.answerCbQuery('Недостаточно прав');
      return;
    }
    await executeSendBroadcast(ctx, bot, Number(ctx.match[1]));
  });

  bot.action(/^bc:delete:(\d+)$/, async (ctx) => {
    if (!isPaymentAdmin(ctx)) {
      await ctx.answerCbQuery('Недостаточно прав');
      return;
    }
    await promptDeleteBroadcast(ctx, Number(ctx.match[1]));
  });

  bot.action(/^bc:delete_confirm:(\d+)$/, async (ctx) => {
    if (!isPaymentAdmin(ctx)) {
      await ctx.answerCbQuery('Недостаточно прав');
      return;
    }
    await executeDeleteBroadcast(ctx, Number(ctx.match[1]));
  });
}
