import { Context, Input, Telegraf } from 'telegraf';
import { config, resolveQrImagePath } from './config';
import {
  clearPaymentState,
  getUser,
  savePendingFio,
  savePendingReceipt,
  setAwaitingPayment,
  User,
} from './db';
import { forwardPaymentToAdmin, forwardPdfToAdmin, forwardPhotoToAdmin, isPdfDocument } from './forwarding';
import { backToMenuKeyboard } from './keyboards';

export async function showTicketsMenu(ctx: Context): Promise<void> {
  await clearPaymentState(ctx.from!.id);
  await ctx.reply(config.content.sections.tickets.message, config.ticketsKeyboard);
}

export async function startQrPaymentFlow(ctx: Context): Promise<void> {
  const qrPath = resolveQrImagePath();
  if (!qrPath) {
    await ctx.reply(
      'QR-код временно недоступен. Положите файл images/qr-payment.png в проект.',
      config.ticketsKeyboard,
    );
    return;
  }

  await setAwaitingPayment(ctx.from!.id, true);
  await ctx.replyWithPhoto(Input.fromLocalFile(qrPath), backToMenuKeyboard);
  await ctx.reply(config.content.payment.qrInstructions, backToMenuKeyboard);
}

export async function returnToMainMenu(ctx: Context, message?: string): Promise<void> {
  if (ctx.from) {
    await clearPaymentState(ctx.from.id);
  }
  await ctx.reply(message ?? config.content.fallback, config.mainMenuKeyboard);
}

async function tryCompletePayment(ctx: Context, bot: Telegraf, user: User): Promise<boolean> {
  if (!user.awaiting_payment || !user.pending_receipt_file_id || !user.pending_fio) {
    return false;
  }

  await forwardPaymentToAdmin(ctx, bot, user);
  await clearPaymentState(user.telegram_id);
  await ctx.reply(config.content.payment.completed, config.mainMenuKeyboard);
  return true;
}

export async function handlePaymentPhoto(ctx: Context, bot: Telegraf): Promise<boolean> {
  const user = await getUser(ctx.from!.id);
  if (!user?.awaiting_payment) {
    return false;
  }

  const photos = ctx.message && 'photo' in ctx.message ? ctx.message.photo : undefined;
  if (!photos?.length) {
    return true;
  }

  const largestPhoto = photos[photos.length - 1];
  await savePendingReceipt(user.telegram_id, largestPhoto.file_id, 'photo');

  const updated = await getUser(user.telegram_id);
  if (!updated) {
    return true;
  }

  if (await tryCompletePayment(ctx, bot, updated)) {
    return true;
  }

  await ctx.reply(config.content.payment.needFio, backToMenuKeyboard);
  return true;
}

export async function handlePaymentDocument(ctx: Context, bot: Telegraf): Promise<boolean> {
  const user = await getUser(ctx.from!.id);
  if (!user?.awaiting_payment) {
    return false;
  }

  const document =
    ctx.message && 'document' in ctx.message ? ctx.message.document : undefined;
  if (!document || !isPdfDocument(document)) {
    await ctx.reply(config.content.payment.invalidReceipt, backToMenuKeyboard);
    return true;
  }

  await savePendingReceipt(user.telegram_id, document.file_id, 'document');

  const updated = await getUser(user.telegram_id);
  if (!updated) {
    return true;
  }

  if (await tryCompletePayment(ctx, bot, updated)) {
    return true;
  }

  await ctx.reply(config.content.payment.needFio, backToMenuKeyboard);
  return true;
}

export async function handlePaymentText(ctx: Context, bot: Telegraf, text: string): Promise<boolean> {
  const user = await getUser(ctx.from!.id);
  if (!user?.awaiting_payment) {
    return false;
  }

  await savePendingFio(user.telegram_id, text.trim());

  const updated = await getUser(user.telegram_id);
  if (!updated) {
    return true;
  }

  if (await tryCompletePayment(ctx, bot, updated)) {
    return true;
  }

  await ctx.reply(config.content.payment.needReceipt, backToMenuKeyboard);
  return true;
}

export async function handleGeneralPhoto(ctx: Context, bot: Telegraf): Promise<void> {
  const photos = ctx.message && 'photo' in ctx.message ? ctx.message.photo : undefined;
  if (!photos?.length) return;

  const largestPhoto = photos[photos.length - 1];
  await forwardPhotoToAdmin(ctx, bot, 'Фото от пользователя', largestPhoto.file_id);
}

export async function handleGeneralPdf(ctx: Context, bot: Telegraf): Promise<void> {
  const document =
    ctx.message && 'document' in ctx.message ? ctx.message.document : undefined;
  if (!document || !isPdfDocument(document)) {
    return;
  }

  await forwardPdfToAdmin(ctx, bot, 'PDF от пользователя', document.file_id);
}
