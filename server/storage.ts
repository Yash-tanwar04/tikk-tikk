import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import webpush from 'web-push';
import { DatabaseSchema, Connection, Signal, PushSubscriptionData, SignalType, User } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// In-memory state initialized from file
let db: DatabaseSchema = {
  vapidKeys: {
    publicKey: '',
    privateKey: ''
  },
  connections: {},
  signals: [],
  pushSubscriptions: {}
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// Load database if exists, or initialize
function initDb() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(content);
    } catch (err) {
      console.error('Failed to parse db.json, re-initializing:', err);
    }
  }

  // Generate VAPID keys if not present
  if (!db.vapidKeys || !db.vapidKeys.publicKey || !db.vapidKeys.privateKey) {
    try {
      const generated = webpush.generateVAPIDKeys();
      db.vapidKeys = {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey
      };
      saveDbImmediate();
    } catch (err) {
      console.error('Failed to generate VAPID keys:', err);
    }
  }
}

initDb();

let saveTimeout: NodeJS.Timeout | null = null;
function saveDb() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save db.json:', err);
    }
  }, 300);
}

function saveDbImmediate() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save db.json immediately:', err);
  }
}

export function getVapidPublicKey(): string {
  return db.vapidKeys?.publicKey || '';
}

export function getVapidPrivateKey(): string {
  return db.vapidKeys?.privateKey || '';
}

// Helper to generate formatted 6-char pairing code: e.g. 7KQ-29M
export function generatePairingCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 3; i++) {
    part1 += chars[Math.floor(Math.random() * chars.length)];
    part2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${part1}-${part2}`;
}

export function createConnection(userName: string, customPartnerName?: string): { connection: Connection; user: User } {
  const connectionId = 'conn_' + crypto.randomUUID().slice(0, 8);
  const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
  const pairingCode = generatePairingCode();

  const user: User = {
    id: userId,
    name: userName.trim() || 'Me',
    customPartnerName: customPartnerName?.trim() || 'My Person',
    lastSeen: Date.now(),
    isOnline: true
  };

  const connection: Connection = {
    id: connectionId,
    pairingCode: pairingCode.toUpperCase(),
    user_a: user,
    user_b: null,
    createdAt: Date.now(),
    pairedAt: null,
    status: 'waiting'
  };

  db.connections[connectionId] = connection;
  saveDb();

  return { connection, user };
}

export function getConnection(id: string): Connection | null {
  return db.connections[id] || null;
}

export function getConnectionByCode(code: string): Connection | null {
  const formatted = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  // Also check without dash
  const normalized = formatted.replace(/-/g, '');

  for (const conn of Object.values(db.connections)) {
    const connNorm = conn.pairingCode.replace(/-/g, '');
    if ((conn.pairingCode === formatted || connNorm === normalized) && conn.status === 'waiting') {
      return conn;
    }
  }
  return null;
}

export function joinConnection(pairingCode: string, userName: string, customPartnerName?: string): { connection: Connection; user: User } | { error: string } {
  const connection = getConnectionByCode(pairingCode);
  if (!connection) {
    // Check if code was already paired
    const formatted = pairingCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const normalized = formatted.replace(/-/g, '');
    for (const conn of Object.values(db.connections)) {
      const connNorm = conn.pairingCode.replace(/-/g, '');
      if (conn.pairingCode === formatted || connNorm === normalized) {
        if (conn.status === 'paired') {
          return { error: 'This connection already has two people paired.' };
        }
      }
    }
    return { error: 'Invalid pairing code. Please check the code and try again.' };
  }

  if (connection.user_b !== null) {
    return { error: 'This connection is already paired.' };
  }

  const userId = 'usr_' + crypto.randomUUID().slice(0, 8);
  const user: User = {
    id: userId,
    name: userName.trim() || 'My Person',
    customPartnerName: customPartnerName?.trim() || connection.user_a.name,
    lastSeen: Date.now(),
    isOnline: true
  };

  connection.user_b = user;
  connection.pairedAt = Date.now();
  connection.status = 'paired';

  db.connections[connection.id] = connection;
  saveDb();

  return { connection, user };
}

export function updateUserName(connectionId: string, userId: string, name: string, customPartnerName?: string): Connection | null {
  const connection = db.connections[connectionId];
  if (!connection) return null;

  if (connection.user_a.id === userId) {
    connection.user_a.name = name.trim() || connection.user_a.name;
    if (customPartnerName !== undefined) {
      connection.user_a.customPartnerName = customPartnerName.trim();
    }
  } else if (connection.user_b && connection.user_b.id === userId) {
    connection.user_b.name = name.trim() || connection.user_b.name;
    if (customPartnerName !== undefined) {
      connection.user_b.customPartnerName = customPartnerName.trim();
    }
  }

  db.connections[connectionId] = connection;
  saveDb();
  return connection;
}

export function disconnectConnection(connectionId: string, userId: string): Connection | null {
  const connection = db.connections[connectionId];
  if (!connection) return null;

  if (connection.user_a.id === userId || (connection.user_b && connection.user_b.id === userId)) {
    connection.status = 'disconnected';
    db.connections[connectionId] = connection;
    saveDb();
    return connection;
  }
  return null;
}

export function updateUserPresence(connectionId: string, userId: string, isOnline: boolean): Connection | null {
  const connection = db.connections[connectionId];
  if (!connection) return null;

  const now = Date.now();
  if (connection.user_a.id === userId) {
    connection.user_a.isOnline = isOnline;
    connection.user_a.lastSeen = now;
  } else if (connection.user_b && connection.user_b.id === userId) {
    connection.user_b.isOnline = isOnline;
    connection.user_b.lastSeen = now;
  }

  saveDb();
  return connection;
}

export function addSignal(connectionId: string, senderId: string, type: SignalType, message?: string): { signal: Signal; recipientId: string } | null {
  const connection = db.connections[connectionId];
  if (!connection || connection.status !== 'paired') return null;

  let recipientId = '';
  let senderName = '';

  if (connection.user_a.id === senderId) {
    if (!connection.user_b) return null;
    recipientId = connection.user_b.id;
    senderName = connection.user_a.name;
  } else if (connection.user_b && connection.user_b.id === senderId) {
    recipientId = connection.user_a.id;
    senderName = connection.user_b.name;
  } else {
    return null;
  }

  const signal: Signal = {
    id: 'sig_' + crypto.randomUUID().slice(0, 10),
    connectionId,
    senderId,
    senderName,
    recipientId,
    type,
    message: message?.trim() || undefined,
    createdAt: Date.now()
  };

  db.signals.push(signal);
  // Cap historical signals to keep storage light (last 500 signals)
  if (db.signals.length > 500) {
    db.signals = db.signals.slice(-500);
  }

  saveDb();
  return { signal, recipientId };
}

export function getSignals(connectionId: string, limit = 100): Signal[] {
  return db.signals
    .filter((s) => s.connectionId === connectionId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function markSignalRead(connectionId: string, signalId: string, readerUserId: string): Signal | null {
  const sig = db.signals.find((s) => s.id === signalId && s.connectionId === connectionId);
  if (sig && sig.recipientId === readerUserId && !sig.readAt) {
    sig.readAt = Date.now();
    saveDb();
    return sig;
  }
  return null;
}

export function savePushSubscription(userId: string, subscription: any): boolean {
  if (!userId || !subscription || !subscription.endpoint || !subscription.keys) {
    return false;
  }

  db.pushSubscriptions[userId] = {
    userId,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    },
    updatedAt: Date.now()
  };

  saveDb();
  return true;
}

export function getPushSubscription(userId: string): PushSubscriptionData | null {
  return db.pushSubscriptions[userId] || null;
}

export function removePushSubscription(userId: string): void {
  delete db.pushSubscriptions[userId];
  saveDb();
}
