export type BroadcastMessageType =
  | 'text'
  | 'photo'
  | 'video'
  | 'video_note'
  | 'document'
  | 'voice'
  | 'audio'
  | 'animation'
  | 'sticker';

export interface BroadcastMessagePayload {
  text?: string;
  file_id?: string;
  caption?: string;
}

export interface BroadcastMessage {
  id: number;
  broadcast_id: number;
  sort_order: number;
  message_type: BroadcastMessageType;
  payload: BroadcastMessagePayload;
}

export interface Broadcast {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export type BroadcastSessionState = 'awaiting_name' | 'composing';

export interface BroadcastSession {
  admin_telegram_id: number;
  state: BroadcastSessionState;
  draft_broadcast_id: number | null;
}

export interface BroadcastSendResult {
  total: number;
  sent: number;
  failed: number;
}
