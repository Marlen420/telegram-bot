import { Context, Input, Markup, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { ClickAction } from '../clicks';
import { config, resolveVideoPath } from '../config';
import { recordClick, saveUser } from '../db';
import { BUTTONS, mainMenuKeyboard } from '../keyboards';
import { extractUserFromContext } from '../userTracking';
import { getVideoDimensions } from '../videoUtils';

async function trackAction(ctx: Context, action: ClickAction): Promise<void> {
  const userData = extractUserFromContext(ctx);
  if (!userData) return;
  await saveUser(userData);
  await recordClick(userData.id, action);
}

async function sendLocalVideo(
  ctx: Context,
  videoFile: string,
  messageText: string,
): Promise<void> {
  const filePath = resolveVideoPath(videoFile);
  if (!filePath) {
    await ctx.reply(
      `Видео «${videoFile}» не найдено. Положите файл about/prices/bonuses в папку videos/ (форматы .mp4 или .MOV)`,
      mainMenuKeyboard,
    );
    return;
  }

  const dimensions = getVideoDimensions(filePath);

  await ctx.replyWithVideo(Input.fromLocalFile(filePath), {
    ...(dimensions ?? {}),
    supports_streaming: true,
  });
  await ctx.reply(messageText.trim() || config.content.fallback, mainMenuKeyboard);
}

export function registerHandlers(bot: Telegraf<Context>): void {
  const { content } = config;

  bot.start(async (ctx) => {
    await trackAction(ctx, 'start');
    await ctx.reply(content.welcome, mainMenuKeyboard);
  });

  bot.hears(BUTTONS.about, async (ctx) => {
    await trackAction(ctx, 'about');
    const section = content.sections.about;
    await sendLocalVideo(ctx, section.video, section.message);
  });

  bot.hears(BUTTONS.prices, async (ctx) => {
    await trackAction(ctx, 'prices');
    const section = content.sections.prices;
    await sendLocalVideo(ctx, section.video, section.message);
  });

  bot.hears(BUTTONS.bonuses, async (ctx) => {
    await trackAction(ctx, 'bonuses');
    const section = content.sections.bonuses;
    await sendLocalVideo(ctx, section.video, section.message);
  });

  bot.hears(BUTTONS.tickets, async (ctx) => {
    await trackAction(ctx, 'tickets');
    const section = content.sections.tickets;
    await ctx.reply(
      section.message,
      Markup.inlineKeyboard([Markup.button.url(section.buttonText, config.ticketUrl)]),
    );
  });

  bot.on(message('contact'), async (ctx) => {
    const contact = ctx.message.contact;
    const userData = extractUserFromContext(ctx, {
      phone: contact.phone_number,
      phone_shared_at: new Date().toISOString(),
    });
    if (!userData) return;
    await saveUser(userData);
    await recordClick(userData.id, 'other');
    await ctx.reply('Спасибо! Контакт сохранён.', mainMenuKeyboard);
  });

  bot.on(message('text'), async (ctx) => {
    await trackAction(ctx, 'other');
    await ctx.reply(content.fallback, mainMenuKeyboard);
  });
}
