// WebSocket client manager with auto-reconnect & presence

export type SocketEventHandler = (data: any) => void;
export type StateChangeHandler = (state: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') => void;

export class RealtimeSocket {
  private ws: WebSocket | null = null;
  private connectionId: string;
  private userId: string;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isIntentionallyClosed = false;

  private onMessageHandler: SocketEventHandler | null = null;
  private onStateChangeHandler: StateChangeHandler | null = null;

  constructor(connectionId: string, userId: string) {
    this.connectionId = connectionId;
    this.userId = userId;
  }

  public setOnMessage(handler: SocketEventHandler) {
    this.onMessageHandler = handler;
  }

  public setOnStateChange(handler: StateChangeHandler) {
    this.onStateChangeHandler = handler;
  }

  public connect() {
    if (typeof window === 'undefined') return;
    this.isIntentionallyClosed = false;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.notifyState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?connectionId=${encodeURIComponent(this.connectionId)}&userId=${encodeURIComponent(this.userId)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyState('connected');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessageHandler) {
            this.onMessageHandler(data);
          }
        } catch (e) {
          // ignore non-json
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (!this.isIntentionallyClosed) {
          this.notifyState('disconnected');
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket connection notice:', err);
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyState('disconnected');
  }

  private scheduleReconnect() {
    if (this.isIntentionallyClosed) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.notifyState('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private notifyState(state: 'connecting' | 'connected' | 'disconnected' | 'reconnecting') {
    if (this.onStateChangeHandler) {
      this.onStateChangeHandler(state);
    }
  }
}
