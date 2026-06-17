import { Context, Input, Markup, Telegraf } from 'telegraf';
import { config, resolveVideoPath } from '../config';
import { saveUser } from '../db';
import { BUTTONS, mainMenuKeyboard } from '../keyboards';
import { getVideoDimensions } from '../videoUtils';

async function trackUser(ctx: Context): Promise<void> {
  const user = ctx.from;
  if (!user) return;
  await saveUser(user);
}

async function sendLocalVideo(
  ctx: Context,
  videoFile: string,
  message: string,
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
  await ctx.reply(message.trim() || config.content.fallback, mainMenuKeyboard);
}

export function registerHandlers(bot: Telegraf<Context>): void {
  const { content } = config;

  bot.start(async (ctx) => {
    await trackUser(ctx);
    await ctx.reply(content.welcome, mainMenuKeyboard);
  });

  bot.hears(BUTTONS.about, async (ctx) => {
    await trackUser(ctx);
    const section = content.sections.about;
    await sendLocalVideo(ctx, section.video, section.message);
  });

  bot.hears(BUTTONS.prices, async (ctx) => {
    await trackUser(ctx);
    const section = content.sections.prices;
    await sendLocalVideo(ctx, section.video, section.message);
  });

  bot.hears(BUTTONS.bonuses, async (ctx) => {
    await trackUser(ctx);
    const section = content.sections.bonuses;
    await sendLocalVideo(ctx, section.video, section.message);
  });

  bot.hears(BUTTONS.tickets, async (ctx) => {
    await trackUser(ctx);
    const section = content.sections.tickets;
    await ctx.reply(
      section.message,
      Markup.inlineKeyboard([Markup.button.url(section.buttonText, config.ticketUrl)]),
    );
  });

  bot.on('message', async (ctx) => {
    await trackUser(ctx);
    await ctx.reply(content.fallback, mainMenuKeyboard);
  });
}
