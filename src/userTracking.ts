import { Context } from 'telegraf';

export interface TelegramUserInput {
  id: number;
  chat_id: number | null;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
  is_bot?: boolean;
  is_premium?: boolean;
  chat_type?: string;
  phone?: string;
  phone_shared_at?: string;
  last_message_text?: string;
}

export function extractUserFromContext(
  ctx: Context,
  extras: Partial<Pick<TelegramUserInput, 'phone' | 'phone_shared_at'>> = {},
): TelegramUserInput | null {
  const user = ctx.from;
  if (!user) return null;

  let lastMessageText: string | undefined;
  const message = ctx.message;
  if (message && 'text' in message && typeof message.text === 'string') {
    lastMessageText = message.text;
  }

  return {
    id: user.id,
    chat_id: ctx.chat?.id ?? user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    language_code: user.language_code,
    is_bot: user.is_bot ?? false,
    is_premium: user.is_premium ?? false,
    chat_type: ctx.chat?.type ?? 'private',
    last_message_text: lastMessageText,
    phone: extras.phone,
    phone_shared_at: extras.phone_shared_at,
  };
}
