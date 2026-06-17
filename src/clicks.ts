export type ClickAction = 'start' | 'about' | 'prices' | 'bonuses' | 'tickets' | 'other';

export const CLICK_ACTIONS: ClickAction[] = [
  'start',
  'about',
  'prices',
  'bonuses',
  'tickets',
  'other',
];

export const ACTION_LABELS: Record<ClickAction, string> = {
  start: '/start',
  about: 'О форуме',
  prices: 'Цены',
  bonuses: 'Подробнее о форуме',
  tickets: 'Как купить билеты',
  other: 'Другое',
};
