import { Telegraf } from 'telegraf';
import { BroadcastMessage } from './types';

const SEND_DELAY_MS = 40;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBlockedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const response = (error as { response?: { error_code?: number; description?: string } }).response;
  if (response?.error_code === 403) {
    return true;
  }

  const description = response?.description?.toLowerCase() ?? '';
  return description.includes('blocked') || description.includes('deactivated');
}

export async function sendBroadcastMessage(
  telegram: Telegraf['telegram'],
  chatId: number,
  message: BroadcastMessage,
): Promise<void> {
  const { message_type: type, payload } = message;

  switch (type) {
    case 'text':
      await telegram.sendMessage(chatId, payload.text ?? '');
      return;
    case 'photo':
      await telegram.sendPhoto(chatId, payload.file_id!, {
        caption: payload.caption,
      });
      return;
    case 'video':
      await telegram.sendVideo(chatId, payload.file_id!, {
        caption: payload.caption,
      });
      return;
    case 'video_note':
      await telegram.sendVideoNote(chatId, payload.file_id!);
      return;
    case 'document':
      await telegram.sendDocument(chatId, payload.file_id!, {
        caption: payload.caption,
      });
      return;
    case 'voice':
      await telegram.sendVoice(chatId, payload.file_id!, {
        caption: payload.caption,
      });
      return;
    case 'audio':
      await telegram.sendAudio(chatId, payload.file_id!, {
        caption: payload.caption,
      });
      return;
    case 'animation':
      await telegram.sendAnimation(chatId, payload.file_id!, {
        caption: payload.caption,
      });
      return;
    case 'sticker':
      await telegram.sendSticker(chatId, payload.file_id!);
      return;
    default:
      throw new Error(`Unsupported broadcast message type: ${type}`);
  }
}

export async function sendBroadcastToUser(
  telegram: Telegraf['telegram'],
  chatId: number,
  messages: BroadcastMessage[],
): Promise<void> {
  for (const item of messages) {
    await sendBroadcastMessage(telegram, chatId, item);
    await sleep(20);
  }
}

export async function sendBroadcastToAllUsers(
  bot: Telegraf,
  recipientIds: number[],
  messages: BroadcastMessage[],
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const recipientId of recipientIds) {
    try {
      await sendBroadcastToUser(bot.telegram, recipientId, messages);
      sent += 1;
    } catch (error) {
      failed += 1;
      if (!isBlockedError(error)) {
        console.error(`Broadcast failed for user ${recipientId}:`, error);
      }
    }

    await sleep(SEND_DELAY_MS);
  }

  return { sent, failed };
}
