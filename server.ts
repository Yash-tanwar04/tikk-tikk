import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
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
} from './server/storage';
import { setupWebSocket, broadcastToRoom, isUserOnlineInRoom } from './server/ws';
import { sendPushNotification } from './server/push';
import { SignalType } from './server/types';

// Rate limiting map: userId -> timestamps array
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(userId: string, maxRequests = 12, windowMs = 5000): boolean {
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

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // Get VAPID Public Key for Web Push subscription
  app.get('/api/push/vapid-public-key', (_req, res) => {
    const publicKey = getVapidPublicKey();
    res.json({ publicKey });
  });

  // Save/Update Web Push Subscription
  app.post('/api/push/subscribe', (req, res) => {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) {
      return res.status(400).json({ error: 'userId and subscription required' });
    }
    const success = savePushSubscription(userId, subscription);
    return res.json({ success });
  });

  // Send Test Push Notification
  app.post('/api/push/test', async (req, res) => {
    const { userId, connectionId } = req.body;
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
  app.post('/api/connections/create', (req, res) => {
    const { userName, customPartnerName } = req.body;
    if (!userName || typeof userName !== 'string') {
      return res.status(400).json({ error: 'Name is required' });
    }

    const { connection, user } = createConnection(userName, customPartnerName);
    res.json({ connection, user });
  });

  // Join connection room via pairing code
  app.post('/api/connections/join', (req, res) => {
    const { pairingCode, userName, customPartnerName } = req.body;
    if (!pairingCode || !userName) {
      return res.status(400).json({ error: 'Pairing code and name are required' });
    }

    const result = joinConnection(pairingCode, userName, customPartnerName);
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }

    // Broadcast to room that partner has paired!
    broadcastToRoom(result.connection.id, {
      type: 'partner_paired',
      connection: result.connection,
      partner: result.user
    });

    res.json({ connection: result.connection, user: result.user });
  });

  // Get connection details
  app.get('/api/connections/:id', (req, res) => {
    const connection = getConnection(req.params.id);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    res.json({ connection });
  });

  // Update user profile info in connection
  app.post('/api/connections/:id/update-name', (req, res) => {
    const { userId, name, customPartnerName } = req.body;
    if (!userId || !name) {
      return res.status(400).json({ error: 'userId and name required' });
    }

    const connection = updateUserName(req.params.id, userId, name, customPartnerName);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    broadcastToRoom(connection.id, {
      type: 'connection_updated',
      connection
    });

    res.json({ connection });
  });

  // Disconnect connection
  app.post('/api/connections/:id/disconnect', (req, res) => {
    const { userId } = req.body;
    const connection = disconnectConnection(req.params.id, userId);
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    broadcastToRoom(connection.id, {
      type: 'connection_disconnected',
      disconnectedBy: userId
    });

    res.json({ success: true, connection });
  });

  // Get recent signals / timeline
  app.get('/api/connections/:id/signals', (req, res) => {
    const signals = getSignals(req.params.id, 100);
    res.json({ signals });
  });

  // Send a signal (love, hug, kiss, miss_you, call_me, message)
  app.post('/api/connections/:id/signals', async (req, res) => {
    const connectionId = req.params.id;
    const { senderId, type, message } = req.body;

    if (!senderId || !type) {
      return res.status(400).json({ error: 'senderId and type are required' });
    }

    const validTypes: SignalType[] = ['love', 'hug', 'kiss', 'miss_you', 'call_me', 'message'];
    if (!validTypes.includes(type as SignalType)) {
      return res.status(400).json({ error: 'Invalid signal type' });
    }

    // Rate limiting check
    if (!checkRateLimit(senderId, 12, 5000)) {
      return res.status(429).json({ error: 'Sending too fast. Please take a gentle breath.' });
    }

    const result = addSignal(connectionId, senderId, type as SignalType, message);
    if (!result) {
      return res.status(400).json({ error: 'Unable to send signal. Check connection status.' });
    }

    const { signal, recipientId } = result;

    // 1. Broadcast to WebSocket room in real-time
    broadcastToRoom(connectionId, {
      type: 'signal_received',
      signal
    });

    // 2. Check if recipient is active in the room right now
    const recipientIsOnline = isUserOnlineInRoom(connectionId, recipientId);
    
    // Always attempt Web Push if recipient has subscribed, so their background device receives it
    const signalDisplayLabels: Record<SignalType, { title: string; body: string }> = {
      love: { title: 'Love Link ❤️', body: `${signal.senderName} is thinking of you.` },
      hug: { title: 'Love Link 🫂', body: `${signal.senderName} sent you a warm hug.` },
      kiss: { title: 'Love Link 💋', body: `${signal.senderName} sent you a kiss.` },
      miss_you: { title: 'Love Link 🥺', body: `${signal.senderName} misses you.` },
      call_me: { title: 'Love Link 📞', body: `${signal.senderName} wants to talk with you.` },
      message: { title: `${signal.senderName} sent a note`, body: message || 'Thinking of you ❤️' }
    };

    const label = signalDisplayLabels[signal.type] || { title: 'Love Link ❤️', body: `${signal.senderName} sent you a signal.` };

    // Send push notification asynchronously (non-blocking for speedy response)
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
  app.post('/api/connections/:id/signals/:signalId/read', (req, res) => {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const sig = markSignalRead(req.params.id, req.params.signalId, userId);
    if (sig) {
      broadcastToRoom(req.params.id, {
        type: 'signal_read',
        signalId: sig.id,
        readAt: sig.readAt
      });
      return res.json({ success: true, signal: sig });
    }

    res.json({ success: false });
  });

  // Mount WebSocket server
  setupWebSocket(server);

  // Setup Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Love Link server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
