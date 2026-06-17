import { Markup } from 'telegraf';

export const BUTTONS = {
  about: '📋 О форуме',
  prices: '💰 Цены',
  bonuses: 'ℹ️ Больше информации',
  tickets: '🎫 Как купить билеты',
  payQr: '💳 Оплатить по QR',
  back: '◀️ Вернуться в меню',
} as const;

export const MAIN_MENU_BUTTON_TEXTS = [
  BUTTONS.about,
  BUTTONS.prices,
  BUTTONS.bonuses,
  BUTTONS.tickets,
] as const;

export const mainMenuKeyboard = Markup.keyboard([
  [BUTTONS.about, BUTTONS.prices],
  [BUTTONS.bonuses, BUTTONS.tickets],
])
  .resize()
  .persistent();

export const ticketsKeyboard = Markup.keyboard([[BUTTONS.payQr], [BUTTONS.back]])
  .resize()
  .persistent();

export const backToMenuKeyboard = Markup.keyboard([[BUTTONS.back]]).resize().persistent();
