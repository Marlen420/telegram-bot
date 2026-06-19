import { Context, Input, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { ClickAction } from '../clicks';
import { config, resolveImagePath, resolveVideoPath } from '../config';
import { clearPaymentState, getUser, recordClick, saveUser } from '../db';
import { BUTTONS, CTA_CALLBACKS, MAIN_MENU_BUTTON_TEXTS } from '../keyboards';
import {
  handleGeneralPdf,
  handleGeneralPhoto,
  handlePaymentDocument,
  handlePaymentPhoto,
  handlePaymentText,
  returnToMainMenu,
  showTicketsMenu,
  startQrPaymentFlow,
} from '../payment';
import { registerAdminHandlers, handleAdminTicketCountText } from '../adminHandlers';
import {
  handleBroadcastAdminMessage,
  handleBroadcastAdminText,
  registerBroadcastHandlers,
} from '../broadcasts/handlers';
import { extractUserFromContext } from '../userTracking';
import { getVideoDimensions } from '../videoUtils';

function isAdmin(ctx: Context): boolean {
  return Boolean(config.forwardToChatId && ctx.from?.id === config.forwardToChatId);
}

function adminMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [[{ text: '📣 Рассылки' }]],
      resize_keyboard: true,
    },
  };
}

async function trackAction(ctx: Context, action: ClickAction): Promise<void> {
  const userData = extractUserFromContext(ctx);
  if (!userData) return;
  await saveUser(userData);
  await recordClick(userData.id, action);
}

function isMainMenuButton(text: string): boolean {
  return (MAIN_MENU_BUTTON_TEXTS as readonly string[]).includes(text);
}

async function sendSectionContent(
  ctx: Context,
  videoFile: string,
  messageText: string,
  ctaText?: string,
): Promise<void> {
  const filePath = resolveVideoPath(videoFile);
  if (!filePath) {
    await ctx.reply(
      `Видео «${videoFile}» не найдено. Положите файл about/prices/bonuses в папку videos/ (форматы .mp4 или .MOV)`,
      config.mainMenuKeyboard,
    );
    return;
  }

  const dimensions = getVideoDimensions(filePath);

  await ctx.replyWithVideo(Input.fromLocalFile(filePath), {
    ...(dimensions ?? {}),
    supports_streaming: true,
  });
  await ctx.reply(messageText.trim() || config.content.fallback, config.mainMenuKeyboard);

  if (ctaText) {
      await ctx.reply(ctaText, config.buyInlineKeyboard());
  }
}

async function sendLocalImage(ctx: Context, imageName: string): Promise<void> {
  const filePath = resolveImagePath(imageName);
  if (!filePath) {
    console.warn(`Image "${imageName}" not found in images directory`);
    return;
  }

  await ctx.replyWithPhoto(Input.fromLocalFile(filePath));
}

async function handleAboutSection(ctx: Context): Promise<void> {
  await trackAction(ctx, 'about');
  await clearPaymentState(ctx.from!.id);
  const section = config.content.sections.about;
  await sendLocalImage(ctx, 'information');
  await sendSectionContent(ctx, section.video, section.message, section.cta);
}

async function handlePricesSection(ctx: Context): Promise<void> {
  await trackAction(ctx, 'prices');
  await clearPaymentState(ctx.from!.id);
  const section = config.content.sections.prices;
  await sendLocalImage(ctx, 'standart-tariff');
  await sendLocalImage(ctx, 'creator-tariff');
  await sendSectionContent(ctx, section.video, section.message, section.cta);
}

async function handleBonusesSection(ctx: Context): Promise<void> {
  await trackAction(ctx, 'bonuses');
  await clearPaymentState(ctx.from!.id);
  const section = config.content.sections.bonuses;
  await sendSectionContent(ctx, section.video, section.message, section.cta);
}

export function registerHandlers(bot: Telegraf<Context>): void {
  const { content } = config;

  registerAdminHandlers(bot);
  registerBroadcastHandlers(bot);

  bot.start(async (ctx) => {
    await trackAction(ctx, 'start');
    await clearPaymentState(ctx.from!.id);
    if (isAdmin(ctx)) {
      await ctx.reply(content.welcome, adminMenuKeyboard());
      return;
    }
    await ctx.reply(content.welcome, config.mainMenuKeyboard);
    if (content.welcomeCta) {
      await ctx.reply(content.welcomeCta, config.welcomeInlineKeyboard());
    }
  });

  bot.hears(BUTTONS.back, async (ctx) => {
    await trackAction(ctx, 'back');
    await returnToMainMenu(ctx);
  });

  bot.hears(BUTTONS.about, handleAboutSection);
  bot.hears(BUTTONS.prices, handlePricesSection);
  bot.hears(BUTTONS.bonuses, handleBonusesSection);

  bot.hears(BUTTONS.tickets, async (ctx) => {
    await trackAction(ctx, 'tickets');
    await showTicketsMenu(ctx);
  });

  bot.hears(BUTTONS.payQr, async (ctx) => {
    await trackAction(ctx, 'pay_qr');
    await startQrPaymentFlow(ctx);
  });

  bot.action(CTA_CALLBACKS.payQr, async (ctx) => {
    await ctx.answerCbQuery();
    await trackAction(ctx, 'pay_qr');
    await startQrPaymentFlow(ctx);
  });

  bot.action(CTA_CALLBACKS.tickets, async (ctx) => {
    await ctx.answerCbQuery();
    await trackAction(ctx, 'tickets');
    await showTicketsMenu(ctx);
  });

  bot.action('nav:about', async (ctx) => {
    await ctx.answerCbQuery();
    await handleAboutSection(ctx);
  });

  bot.action('nav:prices', async (ctx) => {
    await ctx.answerCbQuery();
    await handlePricesSection(ctx);
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
    await ctx.reply('Спасибо! Контакт сохранён.', config.mainMenuKeyboard);
  });

  bot.on(message('photo'), async (ctx) => {
    if (await handleBroadcastAdminMessage(ctx)) {
      return;
    }

    const userData = extractUserFromContext(ctx);
    if (userData) {
      await saveUser(userData);
    }

    if (await handlePaymentPhoto(ctx, bot)) {
      return;
    }

    await handleGeneralPhoto(ctx, bot);
  });

  bot.on(message('document'), async (ctx) => {
    if (await handleBroadcastAdminMessage(ctx)) {
      return;
    }

    const userData = extractUserFromContext(ctx);
    if (userData) {
      await saveUser(userData);
    }

    if (await handlePaymentDocument(ctx, bot)) {
      return;
    }

    await handleGeneralPdf(ctx, bot);
  });

  for (const mediaType of ['video', 'video_note', 'voice', 'audio', 'animation', 'sticker'] as const) {
    bot.on(message(mediaType), async (ctx) => {
      await handleBroadcastAdminMessage(ctx);
    });
  }

  bot.on(message('text'), async (ctx) => {
    const text = ctx.message.text;

    if (text === BUTTONS.back) {
      return;
    }

    if (await handleBroadcastAdminText(ctx, text)) {
      return;
    }

    if (await handleAdminTicketCountText(ctx, bot, text)) {
      return;
    }

    if (isMainMenuButton(text) || text === BUTTONS.payQr) {
      return;
    }

    const userData = extractUserFromContext(ctx);
    if (userData) {
      await saveUser(userData);
    }

    const user = await getUser(ctx.from!.id);
    if (user?.awaiting_payment) {
      await recordClick(user.telegram_id, 'other');
      if (await handlePaymentText(ctx, bot, text)) {
        return;
      }
    }

    await trackAction(ctx, 'other');
    await ctx.reply(content.fallback, config.mainMenuKeyboard);
  });
}
