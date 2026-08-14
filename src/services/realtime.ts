/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RealtimeMessage {
  type: 
    | 'INIT_STATE'
    | 'CLIENT_COUNT'
    | 'MATCH_TIMER'
    | 'MATCH_EVENT'
    | 'MATCH_EVENT_DELETED'
    | 'MATCH_UPDATE'
    | 'MATCH_STATE'
    | 'MATCH_FINALIZED'
    | 'PING'
    | 'PONG';
  payload?: any;
}

export interface LiveMatchSnapshot {
  matchId: number | null;
  categoriaId: number | null;
  elapsedSeconds: number;
  isRunning: boolean;
  period: '1T' | 'INTERVALO' | '2T' | 'FINALIZADO' | string;
  scoreMandante?: number;
  scoreVisitante?: number;
  lastEvent?: any;
  updatedAt?: number;
}

type Listener = (message: RealtimeMessage) => void;

class RealtimeService {
  private socket: WebSocket | null = null;
  private listeners: Set<Listener> = new Set();
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  public isConnected: boolean = false;
  public connectedScreens: number = 1;
  public latestLiveState: LiveMatchSnapshot | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${wsProtocol}//${host}/ws`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        try {
          const message: RealtimeMessage = JSON.parse(event.data);
          
          if (message.type === 'INIT_STATE') {
            if (message.payload?.connectedClients) {
              this.connectedScreens = message.payload.connectedClients;
            }
            if (message.payload?.liveState) {
              this.latestLiveState = message.payload.liveState;
            }
          } else if (message.type === 'CLIENT_COUNT') {
            this.connectedScreens = message.payload?.connectedClients || 1;
          } else if (message.type === 'MATCH_TIMER' || message.type === 'MATCH_STATE') {
            if (message.payload) {
              this.latestLiveState = {
                ...(this.latestLiveState || {
                  matchId: null,
                  categoriaId: null,
                  elapsedSeconds: 0,
                  isRunning: false,
                  period: '1T',
                }),
                ...message.payload,
              };
            }
          }

          // Notify all subscribers
          this.listeners.forEach((listener) => {
            try {
              listener(message);
            } catch (err) {
              console.error('[Realtime] Error in listener callback:', err);
            }
          });
        } catch (e) {
          console.error('[Realtime] Failed to parse incoming WebSocket message:', e);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.warn('[Realtime] WebSocket encountered error, will retry...', err);
        if (this.socket) {
          try {
            this.socket.close();
          } catch (_) {}
        }
      };
    } catch (e) {
      console.error('[Realtime] Connection failed, retrying in 3s:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 2500);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'PING' }));
      }
    }, 20000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) clearInterval(this.pingInterval);
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    // If we already have a latest state, immediately push snapshot
    if (this.latestLiveState) {
      listener({
        type: 'MATCH_STATE',
        payload: this.latestLiveState,
      });
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  public send(type: RealtimeMessage['type'], payload: any = {}) {
    const message: RealtimeMessage = { type, payload };

    // 1. Try sending via WebSocket
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(message));
      } catch (err) {
        console.error('[Realtime] WebSocket send failed:', err);
      }
    }

    // 2. Also send via REST fallback to guarantee synchronization across servers
    fetch('/api/realtime/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    }).catch(() => {});
  }

  public broadcastTimer(
    matchId: number,
    elapsedSeconds: number,
    isRunning: boolean,
    period: string,
    categoriaId?: number
  ) {
    this.send('MATCH_TIMER', {
      matchId,
      elapsedSeconds,
      isRunning,
      period,
      categoriaId,
      updatedAt: Date.now(),
    });
  }

  public broadcastEvent(
    matchId: number,
    event: any,
    score: { scoreMandante: number; scoreVisitante: number }
  ) {
    this.send('MATCH_EVENT', {
      matchId,
      event,
      ...score,
      updatedAt: Date.now(),
    });
  }

  public broadcastMatchFinalized(matchId: number, finalScore: { mandante: number; visitante: number }) {
    this.send('MATCH_FINALIZED', {
      matchId,
      ...finalScore,
      isRunning: false,
      period: 'FINALIZADO',
      updatedAt: Date.now(),
    });
  }

  public async fetchServerLiveState(): Promise<LiveMatchSnapshot | null> {
    try {
      const res = await fetch('/api/realtime/state');
      if (res.ok) {
        const data = await res.json();
        if (data.connectedClients) {
          this.connectedScreens = data.connectedClients;
        }
        if (data.liveState) {
          this.latestLiveState = data.liveState;
          return data.liveState;
        }
      }
    } catch (e) {
      console.warn('[Realtime] Fetch server state error:', e);
    }
    return null;
  }
}

export const realtimeService = new RealtimeService();
