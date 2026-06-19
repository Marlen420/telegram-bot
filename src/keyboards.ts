import { Markup } from 'telegraf';

export const BUTTONS = {
  about: '📋 О форуме',
  prices: '💰 Цены',
  bonuses: 'ℹ️ Больше информации',
  tickets: '🎫 Купить билет',
  payQr: '💳 Оплатить по QR',
  back: '◀️ Вернуться в меню',
} as const;

export const MAIN_MENU_BUTTON_TEXTS = [
  BUTTONS.about,
  BUTTONS.bonuses,
  BUTTONS.prices,
  BUTTONS.tickets,
] as const;

export const mainMenuKeyboard = Markup.keyboard([
  [BUTTONS.about, BUTTONS.bonuses],
  [BUTTONS.prices, BUTTONS.tickets],
])
  .resize()
  .persistent();

export const ticketsKeyboard = Markup.keyboard([[BUTTONS.payQr], [BUTTONS.back]])
  .resize()
  .persistent();

export const backToMenuKeyboard = Markup.keyboard([[BUTTONS.back]]).resize().persistent();

export const CTA_CALLBACKS = {
  payQr: 'buy:pay_qr',
  tickets: 'buy:tickets',
} as const;

export function welcomeInlineKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💳 Купить билет — оплата по QR', CTA_CALLBACKS.payQr)],
    [Markup.button.callback('📋 О форуме', 'nav:about')],
    [Markup.button.callback('💰 Смотреть тарифы', 'nav:prices')],
  ]);
}

export function buyInlineKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💳 Оплатить по QR', CTA_CALLBACKS.payQr)],
    [Markup.button.callback('🎫 Подробнее о покупке', CTA_CALLBACKS.tickets)],
  ]);
}

export function ticketsInlineKeyboard(ticketonUrl: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💳 Оплатить по QR', CTA_CALLBACKS.payQr)],
    [Markup.button.url('🎟 Купить на Ticketon', ticketonUrl)],
  ]);
}
