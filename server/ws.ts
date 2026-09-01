import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { getConnection, updateUserPresence } from './storage';

interface ClientEntry {
  ws: WebSocket;
  userId: string;
  connectionId: string;
  isAlive: boolean;
}

// Map connectionId -> Set<ClientEntry>
const rooms = new Map<string, Set<ClientEntry>>();
// Quick lookup by WebSocket instance
const clientMap = new Map<WebSocket, ClientEntry>();

export function setupWebSocket(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
    
    if (url.pathname === '/ws') {
      const connectionId = url.searchParams.get('connectionId');
      const userId = url.searchParams.get('userId');

      if (!connectionId || !userId) {
        socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, { connectionId, userId });
      });
    }
  });

  wss.on('connection', (ws: WebSocket, _req: any, info?: { connectionId: string; userId: string }) => {
    if (!info) return;
    const { connectionId, userId } = info;

    const clientEntry: ClientEntry = {
      ws,
      userId,
      connectionId,
      isAlive: true
    };

    clientMap.set(ws, clientEntry);

    if (!rooms.has(connectionId)) {
      rooms.set(connectionId, new Set());
    }
    rooms.get(connectionId)!.add(clientEntry);

    // Update presence in storage
    updateUserPresence(connectionId, userId, true);

    // Send welcome / initial state
    const currentConn = getConnection(connectionId);
    if (currentConn) {
      // Determine partner info
      const isUserA = currentConn.user_a.id === userId;
      const partner = isUserA ? currentConn.user_b : currentConn.user_a;
      
      safeSend(ws, {
        type: 'init_sync',
        connection: currentConn,
        partnerPresence: partner ? {
          userId: partner.id,
          isOnline: isUserOnlineInRoom(connectionId, partner.id),
          lastSeen: partner.lastSeen
        } : null
      });
    }

    // Broadcast presence to room
    broadcastToRoom(connectionId, {
      type: 'presence',
      userId,
      isOnline: true,
      lastSeen: Date.now()
    }, userId);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'ping') {
          clientEntry.isAlive = true;
          safeSend(ws, { type: 'pong', timestamp: Date.now() });
        } else if (message.type === 'heartbeat') {
          clientEntry.isAlive = true;
          updateUserPresence(connectionId, userId, true);
        }
      } catch (err) {
        // Non-JSON message or ping frame
      }
    });

    ws.on('pong', () => {
      clientEntry.isAlive = true;
    });

    ws.on('close', () => {
      handleDisconnect(clientEntry);
    });

    ws.on('error', (err) => {
      console.warn('WS Client error:', err);
      handleDisconnect(clientEntry);
    });
  });

  // Heartbeat loop every 20s to detect ghost disconnects
  const interval = setInterval(() => {
    for (const [ws, entry] of clientMap.entries()) {
      if (!entry.isAlive) {
        ws.terminate();
        handleDisconnect(entry);
      } else {
        entry.isAlive = false;
        try {
          ws.ping();
        } catch (e) {
          // ignore
        }
      }
    }
  }, 20000);

  wss.on('close', () => {
    clearInterval(interval);
  });
}

function handleDisconnect(entry: ClientEntry) {
  const { ws, connectionId, userId } = entry;
  clientMap.delete(ws);

  const room = rooms.get(connectionId);
  if (room) {
    room.delete(entry);
    if (room.size === 0) {
      rooms.delete(connectionId);
    }
  }

  // Check if user has any other active tabs/connections in this room
  const stillConnected = isUserOnlineInRoom(connectionId, userId);
  if (!stillConnected) {
    const now = Date.now();
    updateUserPresence(connectionId, userId, false);

    broadcastToRoom(connectionId, {
      type: 'presence',
      userId,
      isOnline: false,
      lastSeen: now
    });
  }
}

export function isUserOnlineInRoom(connectionId: string, userId: string): boolean {
  const room = rooms.get(connectionId);
  if (!room) return false;
  for (const client of room) {
    if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
      return true;
    }
  }
  return false;
}

export function broadcastToRoom(connectionId: string, message: any, excludeUserId?: string) {
  const room = rooms.get(connectionId);
  if (!room) return;

  const data = JSON.stringify(message);
  for (const client of room) {
    if (excludeUserId && client.userId === excludeUserId) continue;
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(data);
      } catch (err) {
        console.error('Failed to send to client in room:', err);
      }
    }
  }
}

function safeSend(ws: WebSocket, message: any) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (e) {
      console.warn('safeSend failed:', e);
    }
  }
}
