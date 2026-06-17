import { Markup } from 'telegraf';

export const BUTTONS = {
  about: '📋 О форуме',
  prices: '💰 Цены',
  bonuses: 'ℹ️ Больше информации',
  tickets: '🎫 Как купить билеты',
} as const;

export const mainMenuKeyboard = Markup.keyboard([
  [BUTTONS.about, BUTTONS.prices],
  [BUTTONS.bonuses, BUTTONS.tickets],
])
  .resize()
  .persistent();
