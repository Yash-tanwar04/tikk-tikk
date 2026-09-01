import express, { Express, Request, Response } from 'express';
import {
  createConnection,
  getConnection,
  joinConnection,
  updateUserName,
  disconnectConnection,
  addSignal,
  getSignals,
  markSignalRead,
  savePushSubscription,
  getVapidPublicKey,
  getPushSubscription
} from './storage';
import { broadcastToRoom, isUserOnlineInRoom } from './ws';
import { sendPushNotification } from './push';
import { SignalType } from './types';

// Rate limiting map: userId -> timestamps array
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(userId: string, maxRequests = 15, windowMs = 5000): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];
  const valid = timestamps.filter((t) => now - t < windowMs);
  if (valid.length >= maxRequests) {
    return false;
  }
  valid.push(now);
  rateLimitMap.set(userId, valid);
  return true;
}

export function createExpressApp(): Express {
  const app = express();
  const router = express.Router();

  // Middleware
  app.use(express.json());

  // CORS headers for flexibility
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // Health check
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Get VAPID Public Key for Web Push subscription
  router.get('/push/vapid-public-key', (_req: Request, res: Response) => {
    try {
      const publicKey = getVapidPublicKey();
      res.json({ publicKey });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to retrieve VAPID public key', message: err?.message });
    }
  });

  // Save/Update Web Push Subscription
  router.post('/push/subscribe', (req: Request, res: Response) => {
    const { userId, subscription } = req.body || {};
    if (!userId || !subscription) {
      return res.status(400).json({ error: 'userId and subscription required' });
    }
    const success = savePushSubscription(userId, subscription);
    return res.json({ success });
  });

  // Send Test Push Notification
  router.post('/push/test', async (req: Request, res: Response) => {
    const { userId, connectionId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const sub = getPushSubscription(userId);
    if (!sub) {
      return res.status(404).json({ error: 'No push subscription registered on server for this user.' });
    }

    const sent = await sendPushNotification(userId, {
      title: 'Love Link ❤️',
      body: 'Test notification from Love Link! Push is working properly.',
      type: 'love',
      connectionId: connectionId || 'test'
    });

    res.json({ success: sent });
  });

  // Create new connection room
  router.post('/connections/create', (req: Request, res: Response) => {
    const { userName, customPartnerName } = req.body || {};
    if (!userName || typeof userName !== 'string' || !userName.trim()) {
      return res.status(400).json({ error: 'Please provide a valid name' });
    }

    try {
      const { connection, user } = createConnection(userName.trim(), customPartnerName ? String(customPartnerName).trim() : undefined);
      res.json({ connection, user });
    } catch (err: any) {
      console.error('Error creating connection:', err);
      res.status(500).json({ error: 'Failed to create connection', message: err?.message });
    }
  });

  // Join connection room via pairing code
  router.post('/connections/join', (req: Request, res: Response) => {
    const { pairingCode, userName, customPartnerName } = req.body || {};
    if (!pairingCode || !userName) {
      return res.status(400).json({ error: 'Pairing code and name are required' });
    }

    const result = joinConnection(String(pairingCode).trim(), String(userName).trim(), customPartnerName ? String(customPartnerName).trim() : undefined);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }

    // Broadcast to room that partner has paired!
    try {
      broadcastToRoom(result.connection.id, {
        type: 'partner_paired',
        connection: result.connection,
        partner: result.user
      });
    } catch {
      // ws optional
    }

    res.json({ connection: result.connection, user: result.user });
  });

  // Get connection details
  router.get('/connections/:id', (req: Request, res: Response) => {
    const connection = getConnection(req.params.id);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    res.json({ connection });
  });

  // Update user profile info in connection
  router.post('/connections/:id/update-name', (req: Request, res: Response) => {
    const { userId, name, customPartnerName } = req.body || {};
    if (!userId || !name) {
      return res.status(400).json({ error: 'userId and name required' });
    }

    const connection = updateUserName(req.params.id, userId, String(name).trim(), customPartnerName ? String(customPartnerName).trim() : undefined);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    try {
      broadcastToRoom(connection.id, {
        type: 'connection_updated',
        connection
      });
    } catch {
      // ws optional
    }

    res.json({ connection });
  });

  // Disconnect connection
  router.post('/connections/:id/disconnect', (req: Request, res: Response) => {
    const { userId } = req.body || {};
    const connection = disconnectConnection(req.params.id, userId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    try {
      broadcastToRoom(connection.id, {
        type: 'connection_disconnected',
        disconnectedBy: userId
      });
    } catch {
      // ws optional
    }

    res.json({ success: true, connection });
  });

  // Get recent signals / timeline
  router.get('/connections/:id/signals', (req: Request, res: Response) => {
    const signals = getSignals(req.params.id, 100);
    res.json({ signals });
  });

  // Send a signal (love, hug, kiss, miss_you, call_me, message)
  router.post('/connections/:id/signals', async (req: Request, res: Response) => {
    const connectionId = req.params.id;
    const { senderId, type, message } = req.body || {};

    if (!senderId || !type) {
      return res.status(400).json({ error: 'senderId and type are required' });
    }

    const validTypes: SignalType[] = ['love', 'hug', 'kiss', 'miss_you', 'call_me', 'message'];
    if (!validTypes.includes(type as SignalType)) {
      return res.status(400).json({ error: 'Invalid signal type' });
    }

    // Rate limiting check
    if (!checkRateLimit(senderId, 15, 5000)) {
      return res.status(429).json({ error: 'Sending too fast. Please take a gentle breath.' });
    }

    const result = addSignal(connectionId, senderId, type as SignalType, message);
    if (!result) {
      return res.status(400).json({ error: 'Unable to send signal. Check connection status.' });
    }

    const { signal, recipientId } = result;

    // 1. Broadcast to WebSocket room in real-time
    try {
      broadcastToRoom(connectionId, {
        type: 'signal_received',
        signal
      });
    } catch {
      // ws optional
    }

    // 2. Check if recipient is active in the room right now
    const recipientIsOnline = isUserOnlineInRoom(connectionId, recipientId);

    const signalDisplayLabels: Record<SignalType, { title: string; body: string }> = {
      love: { title: 'Love Link ❤️', body: `${signal.senderName} is thinking of you.` },
      hug: { title: 'Love Link 🫂', body: `${signal.senderName} sent you a warm hug.` },
      kiss: { title: 'Love Link 💋', body: `${signal.senderName} sent you a kiss.` },
      miss_you: { title: 'Love Link 🥺', body: `${signal.senderName} misses you.` },
      call_me: { title: 'Love Link 📞', body: `${signal.senderName} wants to talk with you.` },
      message: { title: `${signal.senderName} sent a note`, body: message || 'Thinking of you ❤️' }
    };

    const label = signalDisplayLabels[signal.type] || { title: 'Love Link ❤️', body: `${signal.senderName} sent you a signal.` };

    // Send push notification asynchronously
    sendPushNotification(recipientId, {
      title: label.title,
      body: message ? `"${message}"` : label.body,
      type: signal.type,
      connectionId,
      signalId: signal.id
    }).catch((err) => {
      console.warn('Background push delivery note:', err?.message || err);
    });

    res.json({ success: true, signal, recipientIsOnline });
  });

  // Mark signal as read
  router.post('/connections/:id/signals/:signalId/read', (req: Request, res: Response) => {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const sig = markSignalRead(req.params.id, req.params.signalId, userId);
    if (sig) {
      try {
        broadcastToRoom(req.params.id, {
          type: 'signal_read',
          signalId: sig.id,
          readAt: sig.readAt
        });
      } catch {
        // ws optional
      }
      return res.json({ success: true, signal: sig });
    }

    res.json({ success: false });
  });

  // Mount router on BOTH /api and / to handle all routing configurations
  app.use('/api', router);
  app.use('/', router);

  return app;
}
