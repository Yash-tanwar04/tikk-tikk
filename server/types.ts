export type SignalType = 'love' | 'hug' | 'kiss' | 'miss_you' | 'call_me' | 'message';

export interface User {
  id: string;
  name: string;
  customPartnerName?: string;
  lastSeen: number;
  isOnline: boolean;
}

export interface Connection {
  id: string;
  pairingCode: string;
  user_a: User;
  user_b: User | null;
  createdAt: number;
  pairedAt: number | null;
  status: 'waiting' | 'paired' | 'disconnected';
}

export interface Signal {
  id: string;
  connectionId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  type: SignalType;
  message?: string;
  createdAt: number;
  readAt?: number;
}

export interface PushSubscriptionData {
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  updatedAt: number;
}

export interface DatabaseSchema {
  vapidKeys: {
    publicKey: string;
    privateKey: string;
  };
  connections: Record<string, Connection>;
  signals: Signal[];
  pushSubscriptions: Record<string, PushSubscriptionData>;
}

export interface WSClientInfo {
  userId: string;
  connectionId: string;
  isAlive: boolean;
}
