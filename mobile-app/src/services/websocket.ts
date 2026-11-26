import { WS_BASE_URL, getWsBaseUrl, getStoredToken } from './api';

type WebSocketEventListener = (data: any) => void;

class WebSocketService {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Set<WebSocketEventListener>> = new Map();
  private reconnectTimer: any = null;
  private stableTimer: any = null;
  private pingInterval: any = null;
  private isExplicitlyClosed: boolean = false;
  private reconnectAttempts: number = 0;
  private seenEventIds: Set<string> = new Set();
  private hasConnectedBefore: boolean = false;

  connect() {
    const token = getStoredToken();
    if (!token) return;

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isExplicitlyClosed = false;
    const url = `${getWsBaseUrl()}?token=${token}`;
    const ws = new WebSocket(url);
    this.socket = ws;

    ws.onopen = () => {
      if (this.socket !== ws) return;
      console.log('[WS] Connected to real-time dispatch server');

      if (this.stableTimer) clearTimeout(this.stableTimer);
      this.stableTimer = setTimeout(() => {
        this.reconnectAttempts = 0;
      }, 3000);

      this.startHeartbeat();
    };

    ws.onmessage = (event) => {
      if (this.socket !== ws) return;
      try {
        const data = JSON.parse(event.data);
        const eventName = data.event || data.type;

        // Immediately handle server authentication rejection
        if (eventName === 'auth_error') {
          console.warn('[WS] Authentication error received:', data.message || data.error);
          this.isExplicitlyClosed = true;
          this.stopHeartbeat();
          clearTimeout(this.reconnectTimer);
          this.emit('auth_error', data);
          this.disconnect();
          return;
        }

        // Emit connected status only after server confirms authenticated session
        if (eventName === 'connected') {
          const isReconnect = this.hasConnectedBefore;
          this.hasConnectedBefore = true;
          this.emit('connection_status', {
            connected: true,
            reconnecting: false,
            isReconnect,
          });
          this.emit('connected', { isReconnect, ...data });
        }

        // Deduplication check: ignore duplicate message delivery
        if (data.event_id) {
          if (this.seenEventIds.has(data.event_id)) {
            return;
          }
          this.seenEventIds.add(data.event_id);
          if (this.seenEventIds.size > 500) {
            const first = this.seenEventIds.values().next().value;
            if (first) this.seenEventIds.delete(first);
          }
        }

        if (eventName && eventName !== 'connected') {
          this.emit(eventName, data);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      if (this.socket !== ws) return;
      this.stopHeartbeat();
      if (this.stableTimer) {
        clearTimeout(this.stableTimer);
        this.stableTimer = null;
      }
      this.socket = null;

      // Emit disconnected status so UI warns client and switches to REST polling
      const isAuthError = event.code === 4001 || event.code === 4003 || event.code === 1008;
      this.emit('connection_status', {
        connected: false,
        reconnecting: !this.isExplicitlyClosed && !isAuthError,
        code: event.code,
      });
      this.emit('disconnected', { code: event.code });

      // If token expired or rejected by server, stop reconnection storm
      if (isAuthError) {
        console.warn('[WS] Authentication token expired or rejected (close code:', event.code, '). Stopping auto-reconnect.');
        this.emit('auth_error', { code: event.code, reason: 'Token expired or invalid' });
        return;
      }

      if (!this.isExplicitlyClosed && this.reconnectAttempts < 10) {
        this.reconnectAttempts++;
        const baseDelay = Math.min(15000, 1000 * Math.pow(1.5, Math.min(this.reconnectAttempts, 6)));
        const jitter = Math.floor(Math.random() * 800);
        const backoffMs = baseDelay + jitter;

        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.connect();
        }, backoffMs);
      }
    };

    ws.onerror = () => {
      // Suppress raw WebSocket Event flooding
      if (this.reconnectAttempts <= 1) {
        console.warn('[WS] Connection issue, awaiting retry...');
      }
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  sendRiderLocation(latitude: number, longitude: number, heading?: number, speed?: number) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'rider_location',
          latitude,
          longitude,
          heading,
          speed,
        })
      );
    }
  }

  subscribe(event: string, callback: WebSocketEventListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unbind function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(data);
        } catch (e) {
          console.error(`[WS] Error in listener for ${event}:`, e);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  disconnect() {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.stableTimer) {
      clearTimeout(this.stableTimer);
      this.stableTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      const oldWs = this.socket;
      this.socket = null;
      oldWs.onopen = null;
      oldWs.onmessage = null;
      oldWs.onclose = null;
      oldWs.onerror = null;
      try {
        oldWs.close();
      } catch (e) {}
    }
  }

  reconnect() {
    this.disconnect();
    this.isExplicitlyClosed = false;
    this.connect();
  }
}

export const wsService = new WebSocketService();
