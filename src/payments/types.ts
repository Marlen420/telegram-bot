export type PaymentStatus = 'pending' | 'confirmed';

export interface Payment {
  id: number;
  telegram_id: number;
  fio: string;
  receipt_file_id: string | null;
  receipt_kind: string | null;
  status: PaymentStatus;
  ticket_count: number | null;
  confirmed_by: number | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface PaymentStats {
  total: number;
  pending: number;
  confirmed: number;
  ticketsSold: number;
}
