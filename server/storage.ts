import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import webpush from 'web-push';
import { DatabaseSchema, Connection, Signal, PushSubscriptionData, SignalType, User } from './types';

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = isServerless ? path.join('/tmp', 'lovelink-data') : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function createDefaultDb(): DatabaseSchema {
  return {
    vapidKeys: {
      publicKey: '',
      privateKey: ''
    },
    connections: {},
    signals: [],
    pushSubscriptions: {}
  };
}

// In-memory state initialized with defaults
let db: DatabaseSchema = createDefaultDb();

function sanitizeDb(raw: any): DatabaseSchema {
  const result = createDefaultDb();
  if (raw && typeof raw === 'object') {
    if (raw.vapidKeys && typeof raw.vapidKeys === 'object') {
      result.vapidKeys = {
        publicKey: typeof raw.vapidKeys.publicKey === 'string' ? raw.vapidKeys.publicKey : '',
        privateKey: typeof raw.vapidKeys.privateKey === 'string' ? raw.vapidKeys.privateKey : ''
      };
    }
    if (raw.connections && typeof raw.connections === 'object') {
      result.connections = raw.connections;
    }
    if (Array.isArray(raw.signals)) {
      result.signals = raw.signals;
    }
    if (raw.pushSubscriptions && typeof raw.pushSubscriptions === 'object') {
      result.pushSubscriptions = raw.pushSubscriptions;
    }
  }
  return result;
}

// Ensure data directory exists safely
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn('Storage directory initialization warning (using in-memory):', err);
}

// Load database if exists, or initialize
function initDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        db = sanitizeDb(parsed);
      }
    }
  } catch (err) {
    console.error('Failed to parse or read db.json, using clean in-memory state:', err);
    db = createDefaultDb();
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
      console.warn('Notice: VAPID keys generation deferred or fallback:', err);
    }
  }
}

initDb();

let saveTimeout: NodeJS.Timeout | null = null;
function saveDb() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Storage write notice (memory active):', err);
    }
  }, 300);
}

function saveDbImmediate() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Storage immediate write notice (memory active):', err);
  }
}

export function getVapidPublicKey(): string {
  return db.vapidKeys?.publicKey || '';
}

export function getVapidPrivateKey(): string {
  return db.vapidKeys?.privateKey || '';
}

// Safe ID generator
export function generateId(prefix: string): string {
  try {
    if (typeof crypto?.randomBytes === 'function') {
      return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
    }
    if (typeof crypto?.randomUUID === 'function') {
      return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    }
  } catch {}
  return `${prefix}_${Math.random().toString(36).substring(2, 12)}`;
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
  if (!db.connections) {
    db.connections = {};
  }

  const connectionId = generateId('conn');
  const userId = generateId('usr');
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
  if (!db.connections) return null;
  return db.connections[id] || null;
}

export function getConnectionByCode(code: string): Connection | null {
  if (!db.connections) return null;
  const formatted = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const normalized = formatted.replace(/-/g, '');

  for (const conn of Object.values(db.connections)) {
    if (!conn || !conn.pairingCode) continue;
    const connNorm = conn.pairingCode.replace(/-/g, '');
    if ((conn.pairingCode === formatted || connNorm === normalized) && conn.status === 'waiting') {
      return conn;
    }
  }
  return null;
}

export function joinConnection(pairingCode: string, userName: string, customPartnerName?: string): { connection: Connection; user: User } | { error: string } {
  if (!db.connections) db.connections = {};

  const connection = getConnectionByCode(pairingCode);
  if (!connection) {
    const formatted = pairingCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const normalized = formatted.replace(/-/g, '');
    for (const conn of Object.values(db.connections)) {
      if (!conn || !conn.pairingCode) continue;
      const connNorm = conn.pairingCode.replace(/-/g, '');
      if (conn.pairingCode === formatted || connNorm === normalized) {
        if (conn.status === 'paired') {
          return { error: 'This sanctuary already has two people paired.' };
        }
      }
    }
    return { error: 'Invalid pairing code. Please check the code and try again.' };
  }

  if (connection.user_b !== null) {
    return { error: 'This sanctuary is already paired.' };
  }

  const userId = generateId('usr');
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
  if (!db.connections) return null;
  const connection = db.connections[connectionId];
  if (!connection) return null;

  if (connection.user_a && connection.user_a.id === userId) {
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
  if (!db.connections) return null;
  const connection = db.connections[connectionId];
  if (!connection) return null;

  if ((connection.user_a && connection.user_a.id === userId) || (connection.user_b && connection.user_b.id === userId)) {
    connection.status = 'disconnected';
    db.connections[connectionId] = connection;
    saveDb();
    return connection;
  }
  return null;
}

export function updateUserPresence(connectionId: string, userId: string, isOnline: boolean): Connection | null {
  if (!db.connections) return null;
  const connection = db.connections[connectionId];
  if (!connection) return null;

  const now = Date.now();
  if (connection.user_a && connection.user_a.id === userId) {
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
  if (!db.connections || !db.signals) {
    db.connections = db.connections || {};
    db.signals = db.signals || [];
  }

  const connection = db.connections[connectionId];
  if (!connection || connection.status !== 'paired' || !connection.user_a) return null;

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
    id: generateId('sig'),
    connectionId,
    senderId,
    senderName,
    recipientId,
    type,
    message: message?.trim() || undefined,
    createdAt: Date.now()
  };

  db.signals.push(signal);
  if (db.signals.length > 500) {
    db.signals = db.signals.slice(-500);
  }

  saveDb();
  return { signal, recipientId };
}

export function getSignals(connectionId: string, limit = 100): Signal[] {
  if (!Array.isArray(db.signals)) {
    db.signals = [];
    return [];
  }
  return db.signals
    .filter((s) => s && s.connectionId === connectionId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function markSignalRead(connectionId: string, signalId: string, readerUserId: string): Signal | null {
  if (!Array.isArray(db.signals)) return null;
  const sig = db.signals.find((s) => s && s.id === signalId && s.connectionId === connectionId);
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

  if (!db.pushSubscriptions) {
    db.pushSubscriptions = {};
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
  if (!db.pushSubscriptions) return null;
  return db.pushSubscriptions[userId] || null;
}

export function removePushSubscription(userId: string): void {
  if (!db.pushSubscriptions) return;
  delete db.pushSubscriptions[userId];
  saveDb();
}

