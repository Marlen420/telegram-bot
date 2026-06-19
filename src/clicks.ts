export type ClickAction =
  | 'start'
  | 'about'
  | 'prices'
  | 'bonuses'
  | 'tickets'
  | 'pay_qr'
  | 'back'
  | 'other';

export const CLICK_ACTIONS: ClickAction[] = [
  'start',
  'about',
  'prices',
  'bonuses',
  'tickets',
  'pay_qr',
  'back',
  'other',
];

export const ACTION_LABELS: Record<ClickAction, string> = {
  start: '/start',
  about: 'О форуме',
  prices: 'Цены',
  bonuses: 'Подробнее о форуме',
  tickets: 'Купить билет',
  pay_qr: 'Оплатить по QR',
  back: 'Вернуться в меню',
  other: 'Другое',
};
