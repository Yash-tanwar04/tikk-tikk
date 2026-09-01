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

export interface PartnerPresence {
  userId: string;
  isOnline: boolean;
  lastSeen: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface AppSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  reducedMotion: boolean;
}

export type PushPermissionStatus = 'unsupported' | 'default' | 'granted' | 'denied';

export interface SignalConfig {
  type: SignalType;
  label: string;
  verb: string;
  receivedTitle: string;
  receivedSubtext: string;
  icon: string;
  accentColor: string;
  glowColor: string;
  gradient: string;
}
