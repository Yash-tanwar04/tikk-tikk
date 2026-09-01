import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Connection, ConnectionState, Signal, SignalType, User, PartnerPresence, AppSettings, PushPermissionStatus } from '../types';
import { RealtimeSocket } from '../lib/socket';
import { playSignalSound } from '../lib/audio';
import { triggerHaptic } from '../lib/haptics';
import { registerServiceWorker, subscribeUserToPush, getNotificationPermission } from '../lib/push';

interface LoveLinkContextValue {
  connection: Connection | null;
  user: User | null;
  partner: User | null;
  partnerDisplayName: string;
  connectionState: ConnectionState;
  partnerPresence: PartnerPresence;
  signals: Signal[];
  activeIncomingSignal: Signal | null;
  dismissIncomingSignal: () => void;
  sendSignal: (type: SignalType, message?: string) => Promise<{ success: boolean; signal?: Signal; error?: string }>;
  markAsRead: (signalId: string) => Promise<void>;
  createConnection: (userName: string, customPartnerName?: string) => Promise<{ success: boolean; error?: string }>;
  joinConnection: (pairingCode: string, userName: string, customPartnerName?: string) => Promise<{ success: boolean; error?: string }>;
  updateNames: (name: string, customPartnerName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  pushStatus: PushPermissionStatus;
  isPushSubscribed: boolean;
  requestPushPermission: () => Promise<boolean>;
  sendTestPush: () => Promise<boolean>;
  reconnectRealtime: () => void;
}

const LoveLinkContext = createContext<LoveLinkContextValue | null>(null);

const STORAGE_KEYS = {
  CONNECTION_ID: 'lovelink_connection_id',
  USER_ID: 'lovelink_user_id',
  SETTINGS: 'lovelink_settings'
};

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  reducedMotion: false
};

// Helper to safely parse API responses without throwing DOMException / SyntaxError
async function safeApiCall<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const res = await fetch(url, options);
    const text = await res.text();
    let parsed: any = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (res.ok) {
      if (parsed === null && text && (text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html'))) {
        return {
          ok: false,
          status: res.status,
          error: 'Service endpoint not reachable. Please verify server status.'
        };
      }
      return { ok: true, status: res.status, data: parsed as T };
    } else {
      const errorMsg =
        parsed?.error ||
        parsed?.message ||
        (res.status === 404
          ? 'Sanctuary connection not found (404).'
          : res.status === 500
          ? 'Server encountered an issue (500).'
          : `Request failed (${res.status})`);
      return { ok: false, status: res.status, error: errorMsg };
    }
  } catch (err: any) {
    console.warn(`API call failed for ${url}:`, err);
    return { ok: false, status: 0, error: err?.message || 'Network connection error' };
  }
}

export const LoveLinkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [partnerPresence, setPartnerPresence] = useState<PartnerPresence>({
    userId: '',
    isOnline: false,
    lastSeen: Date.now()
  });
  const [signals, setSignals] = useState<Signal[]>([]);
  const [activeIncomingSignal, setActiveIncomingSignal] = useState<Signal | null>(null);
  const [pushStatus, setPushStatus] = useState<PushPermissionStatus>('default');
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const socketRef = useRef<RealtimeSocket | null>(null);
  const audioUnlockedRef = useRef<boolean>(false);

  // Helper to unlock audio on first user touch anywhere
  useEffect(() => {
    const handleFirstGesture = () => {
      if (!audioUnlockedRef.current) {
        audioUnlockedRef.current = true;
        // Trigger subtle tone or empty context resume
        playSignalSound('none', false);
      }
    };
    window.addEventListener('click', handleFirstGesture, { once: true });
    window.addEventListener('touchstart', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
    };
  }, []);

  // Register service worker on initial mount
  useEffect(() => {
    registerServiceWorker().then(() => {
      const status = getNotificationPermission();
      if (status === 'unsupported') {
        setPushStatus('unsupported');
      } else {
        setPushStatus(status as PushPermissionStatus);
        if (status === 'granted') {
          setIsPushSubscribed(true);
        }
      }
    });

    // Listen for quick reply messages from service worker
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.action === 'quick_reply' && event.data?.type) {
          sendSignal(event.data.type);
        }
      });
    }
  }, []);

  // Determine partner user object
  const partner = connection && user
    ? (connection.user_a.id === user.id ? connection.user_b : connection.user_a)
    : null;

  // Custom partner display name or default
  const partnerDisplayName = user?.customPartnerName || partner?.name || 'Your Person';

  // Load connection and history on mount if stored in localStorage
  useEffect(() => {
    const savedConnId = localStorage.getItem(STORAGE_KEYS.CONNECTION_ID);
    const savedUserId = localStorage.getItem(STORAGE_KEYS.USER_ID);

    if (savedConnId && savedUserId) {
      fetchConnectionData(savedConnId, savedUserId);
    }
  }, []);

  const fetchConnectionData = async (connId: string, currentUserId: string) => {
    try {
      setConnectionState('connecting');
      const res = await safeApiCall<{ connection: Connection }>(`/api/connections/${connId}`);
      if (!res.ok || !res.data?.connection) {
        if (res.status === 404) {
          // Connection expired or invalid
          localStorage.removeItem(STORAGE_KEYS.CONNECTION_ID);
          localStorage.removeItem(STORAGE_KEYS.USER_ID);
          setConnection(null);
          setUser(null);
          setConnectionState('disconnected');
        }
        return;
      }

      const conn: Connection = res.data.connection;
      setConnection(conn);

      const currentUser =
        conn.user_a.id === currentUserId
          ? conn.user_a
          : conn.user_b?.id === currentUserId
          ? conn.user_b
          : null;
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Not a member of this connection
        localStorage.removeItem(STORAGE_KEYS.CONNECTION_ID);
        localStorage.removeItem(STORAGE_KEYS.USER_ID);
        setConnection(null);
        setUser(null);
        return;
      }

      // Fetch signals history
      const signalsRes = await safeApiCall<{ signals: Signal[] }>(`/api/connections/${connId}/signals`);
      if (signalsRes.ok && signalsRes.data?.signals) {
        setSignals(signalsRes.data.signals);
      }
    } catch (err) {
      console.warn('Failed to fetch connection data:', err);
      setConnectionState('disconnected');
    }
  };

  // Manage WebSocket connection with polling fallback for serverless/offline
  useEffect(() => {
    if (!connection || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnectionState('disconnected');
      return;
    }

    const socket = new RealtimeSocket(connection.id, user.id);
    socketRef.current = socket;

    socket.setOnStateChange((state) => {
      setConnectionState(state);
    });

    socket.setOnMessage((msg) => {
      if (msg.type === 'init_sync') {
        if (msg.connection) setConnection(msg.connection);
        if (msg.partnerPresence) {
          setPartnerPresence({
            userId: msg.partnerPresence.userId,
            isOnline: msg.partnerPresence.isOnline,
            lastSeen: msg.partnerPresence.lastSeen || Date.now()
          });
        }
      } else if (msg.type === 'presence') {
        if (partner && msg.userId === partner.id) {
          setPartnerPresence({
            userId: msg.userId,
            isOnline: msg.isOnline,
            lastSeen: msg.lastSeen || Date.now()
          });
        }
      } else if (msg.type === 'partner_paired') {
        setConnection(msg.connection);
        if (msg.partner) {
          triggerHaptic('success', settings.vibrationEnabled);
          playSignalSound('love', settings.soundEnabled);
        }
      } else if (msg.type === 'connection_updated') {
        setConnection(msg.connection);
      } else if (msg.type === 'connection_disconnected') {
        setConnection((prev) => (prev ? { ...prev, status: 'disconnected' } : null));
      } else if (msg.type === 'signal_received') {
        const sig: Signal = msg.signal;
        // Add to signals list (avoid duplicate)
        setSignals((prev) => {
          if (prev.some((s) => s.id === sig.id)) return prev;
          return [sig, ...prev];
        });

        // If I am the recipient, trigger the full experience!
        if (sig.recipientId === user.id) {
          setActiveIncomingSignal(sig);
          playSignalSound(sig.type, settings.soundEnabled);
          triggerHaptic(sig.type, settings.vibrationEnabled);
        }
      } else if (msg.type === 'signal_read') {
        setSignals((prev) =>
          prev.map((s) => (s.id === msg.signalId ? { ...s, readAt: msg.readAt } : s))
        );
      }
    });

    socket.connect();

    // Polling fallback when websocket is not open (e.g. serverless environments or reconnecting)
    const pollInterval = setInterval(async () => {
      if (!connection?.id || !user?.id) return;
      try {
        // Poll connection state
        const cRes = await safeApiCall<{ connection: Connection }>(`/api/connections/${connection.id}`);
        if (cRes.ok && cRes.data?.connection) {
          const freshConn = cRes.data.connection;
          setConnection((prev) => {
            if (prev?.status === 'waiting' && freshConn.status === 'paired') {
              triggerHaptic('success', settings.vibrationEnabled);
              playSignalSound('love', settings.soundEnabled);
            }
            return freshConn;
          });

          // Update partner presence based on lastSeen
          const other = freshConn.user_a.id === user.id ? freshConn.user_b : freshConn.user_a;
          if (other) {
            const isRecent = Date.now() - (other.lastSeen || 0) < 60000;
            setPartnerPresence({
              userId: other.id,
              isOnline: isRecent,
              lastSeen: other.lastSeen || Date.now()
            });
          }
        }

        // Poll latest signals
        const sRes = await safeApiCall<{ signals: Signal[] }>(`/api/connections/${connection.id}/signals`);
        if (sRes.ok && sRes.data?.signals) {
          const fetched = sRes.data.signals;
          setSignals((prev) => {
            const prevIds = new Set(prev.map((s) => s.id));
            const newSignals = fetched.filter((s) => !prevIds.has(s.id));
            if (newSignals.length > 0) {
              // Trigger newest incoming signal if meant for me
              const newestForMe = newSignals.find((s) => s.recipientId === user.id);
              if (newestForMe) {
                setActiveIncomingSignal(newestForMe);
                playSignalSound(newestForMe.type, settings.soundEnabled);
                triggerHaptic(newestForMe.type, settings.vibrationEnabled);
              }
              return [...newSignals, ...prev];
            }
            return prev;
          });
        }
      } catch {
        // silent polling catch
      }
    }, 2500);

    return () => {
      clearInterval(pollInterval);
      socket.disconnect();
    };
  }, [connection?.id, user?.id, settings.soundEnabled, settings.vibrationEnabled, partner?.id]);

  const reconnectRealtime = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  }, []);

  const createConnection = async (userName: string, customPartnerName?: string) => {
    try {
      const res = await safeApiCall<{ connection: Connection; user: User }>('/api/connections/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, customPartnerName })
      });

      if (!res.ok || !res.data) {
        return { success: false, error: res.error || 'Failed to create room' };
      }

      setConnection(res.data.connection);
      setUser(res.data.user);
      localStorage.setItem(STORAGE_KEYS.CONNECTION_ID, res.data.connection.id);
      localStorage.setItem(STORAGE_KEYS.USER_ID, res.data.user.id);
      triggerHaptic('success', settings.vibrationEnabled);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  };

  const joinConnection = async (pairingCode: string, userName: string, customPartnerName?: string) => {
    try {
      const res = await safeApiCall<{ connection: Connection; user: User }>('/api/connections/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingCode, userName, customPartnerName })
      });

      if (!res.ok || !res.data) {
        return { success: false, error: res.error || 'Failed to join connection' };
      }

      setConnection(res.data.connection);
      setUser(res.data.user);
      localStorage.setItem(STORAGE_KEYS.CONNECTION_ID, res.data.connection.id);
      localStorage.setItem(STORAGE_KEYS.USER_ID, res.data.user.id);

      triggerHaptic('success', settings.vibrationEnabled);
      playSignalSound('love', settings.soundEnabled);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  };

  const sendSignal = async (type: SignalType, message?: string) => {
    if (!connection || !user) {
      return { success: false, error: 'Not connected' };
    }

    // Play immediate local feedback (haptic + subtle sent chime)
    triggerHaptic('tap', settings.vibrationEnabled);
    playSignalSound('sent', settings.soundEnabled);

    try {
      const res = await safeApiCall<{ signal: Signal }>(`/api/connections/${connection.id}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          type,
          message
        })
      });

      if (!res.ok || !res.data?.signal) {
        return { success: false, error: res.error || 'Failed to send' };
      }

      const newSignal: Signal = res.data.signal;

      // Update local signals list
      setSignals((prev) => {
        if (prev.some((s) => s.id === newSignal.id)) return prev;
        return [newSignal, ...prev];
      });

      return { success: true, signal: newSignal };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error' };
    }
  };

  const markAsRead = async (signalId: string) => {
    if (!connection || !user) return;
    try {
      await safeApiCall(`/api/connections/${connection.id}/signals/${signalId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      setSignals((prev) =>
        prev.map((s) => (s.id === signalId ? { ...s, readAt: Date.now() } : s))
      );
    } catch {
      // Non-fatal
    }
  };

  const updateNames = async (name: string, customPartnerName?: string) => {
    if (!connection || !user) return;
    try {
      const res = await safeApiCall<{ connection: Connection }>(`/api/connections/${connection.id}/update-name`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name,
          customPartnerName
        })
      });
      if (res.ok && res.data?.connection) {
        setConnection(res.data.connection);
        setUser((prev) => (prev ? { ...prev, name, customPartnerName } : null));
        triggerHaptic('success', settings.vibrationEnabled);
      }
    } catch (err) {
      console.warn('Update names error:', err);
    }
  };

  const disconnect = async () => {
    if (connection && user) {
      try {
        await safeApiCall(`/api/connections/${connection.id}/disconnect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id })
        });
      } catch {
        // ignore
      }
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    localStorage.removeItem(STORAGE_KEYS.CONNECTION_ID);
    localStorage.removeItem(STORAGE_KEYS.USER_ID);
    setConnection(null);
    setUser(null);
    setSignals([]);
    setConnectionState('disconnected');
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const requestPushPermission = async (): Promise<boolean> => {
    if (!user) return false;
    const success = await subscribeUserToPush(user.id);
    const status = getNotificationPermission();
    if (status !== 'unsupported') {
      setPushStatus(status as PushPermissionStatus);
    }
    setIsPushSubscribed(success);
    if (success) {
      triggerHaptic('success', settings.vibrationEnabled);
    }
    return success;
  };

  const sendTestPush = async (): Promise<boolean> => {
    if (!user || !connection) return false;
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, connectionId: connection.id })
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const dismissIncomingSignal = () => {
    if (activeIncomingSignal) {
      markAsRead(activeIncomingSignal.id);
    }
    setActiveIncomingSignal(null);
  };

  return (
    <LoveLinkContext.Provider
      value={{
        connection,
        user,
        partner,
        partnerDisplayName,
        connectionState,
        partnerPresence,
        signals,
        activeIncomingSignal,
        dismissIncomingSignal,
        sendSignal,
        markAsRead,
        createConnection,
        joinConnection,
        updateNames,
        disconnect,
        settings,
        updateSettings,
        pushStatus,
        isPushSubscribed,
        requestPushPermission,
        sendTestPush,
        reconnectRealtime
      }}
    >
      {children}
    </LoveLinkContext.Provider>
  );
};

export const useLoveLink = () => {
  const context = useContext(LoveLinkContext);
  if (!context) {
    throw new Error('useLoveLink must be used within a LoveLinkProvider');
  }
  return context;
};
