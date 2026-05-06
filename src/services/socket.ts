import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://flowbackendapi.store';

let socket: Socket | null = null;
let currentSessionId: string | null = null;
let currentToken: string | null = null;
let isConnecting = false;
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
const HEARTBEAT_TIMEOUT_MS = 300_000; // 5 min without any event → force reconnect

// Persistent listener registries — survive socket recreation
const streamListeners = new Set<(event: any) => void>();
const typingListeners = new Set<(data: any) => void>();
// Generic event listeners (connect, disconnect, etc.) — also survive reconnection
const genericListeners = new Map<string, Set<(...args: any[]) => void>>();

// Resolve when socket connects (for awaitable connect)
let connectResolve: (() => void) | null = null;

function clearHeartbeatTimer() {
  if (heartbeatTimer) { clearTimeout(heartbeatTimer); heartbeatTimer = null; }
}

function resetHeartbeatTimer() {
  clearHeartbeatTimer();
  heartbeatTimer = setTimeout(() => {
    console.warn('[Socket] Heartbeat timeout — forcing reconnect');
    if (socket) {
      socket.disconnect();
      // socket.io auto-reconnection will kick in
    }
  }, HEARTBEAT_TIMEOUT_MS);
}

function attachListenersToSocket(s: Socket) {
  s.on('chat:stream', (event: any) => {
    streamListeners.forEach((cb) => cb(event));
  });
  s.on('chat:typing', (data: any) => {
    typingListeners.forEach((cb) => cb(data));
  });
  // Re-attach all generic listeners
  genericListeners.forEach((cbs, event) => {
    cbs.forEach((cb) => s.on(event, cb));
  });
}

// NOTE: AppState reconnection is handled by AuthContext (single source of truth).
// socket.ts only exposes connect/ensureConnected — no autonomous reconnection.

export const socketService = {
  connect(token: string): Socket {
    currentToken = token;

    if (socket?.connected) return socket;
    if (isConnecting && socket) return socket;

    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }

    isConnecting = true;

    socket = io(`${API_URL}/fc-agent-chat`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    attachListenersToSocket(socket);

    socket.on('connect', () => {
      isConnecting = false;
      console.log('[Socket] Connected:', socket?.id);
      // Auto re-join current session room on reconnect
      if (currentSessionId) {
        socket?.emit('join:session', { sessionId: currentSessionId });
      }
      // Start heartbeat watchdog
      resetHeartbeatTimer();
      // Resolve any pending waitForConnect promise
      if (connectResolve) {
        connectResolve();
        connectResolve = null;
      }
    });
    socket.on('disconnect', (reason) => {
      isConnecting = false;
      console.log('[Socket] Disconnected:', reason);
      clearHeartbeatTimer();
    });
    socket.on('connect_error', (err) => {
      isConnecting = false;
      console.warn('[Socket] Error:', err.message);
      // Resolve pending promise on error too — don't block forever
      if (connectResolve) {
        connectResolve();
        connectResolve = null;
      }
    });
    // Any incoming event resets the heartbeat timer
    socket.onAny(() => { resetHeartbeatTimer(); });

    return socket;
  },

  /** Wait for socket to be connected (max 3s). Returns true if connected. */
  async waitForConnect(timeoutMs = 3000): Promise<boolean> {
    if (socket?.connected) return true;
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        connectResolve = null;
        resolve(socket?.connected ?? false);
      }, timeoutMs);
      connectResolve = () => {
        clearTimeout(timer);
        resolve(true);
      };
    });
  },

  /** Ensure socket is alive — force reconnect if stale */
  ensureConnected(): boolean {
    if (socket?.connected) return true;
    if (currentToken) {
      this.connect(currentToken);
    }
    return socket?.connected ?? false;
  },

  /** Join a session room. Returns a promise that resolves when join is confirmed (max 3s). */
  async joinSessionAsync(sessionId: string): Promise<boolean> {
    // Leave previous session room to prevent stream event leaks
    if (currentSessionId && currentSessionId !== sessionId && socket?.connected) {
      socket.emit('leave:session', { sessionId: currentSessionId });
    }
    currentSessionId = sessionId;
    this.ensureConnected();

    // If not connected yet, wait up to 3s
    if (!socket?.connected) {
      const connected = await this.waitForConnect(3000);
      if (!connected && !socket?.connected) {
        console.warn('[Socket] Cannot join session — not connected');
        return false;
      }
    }

    // Emit with acknowledgement and retry logic
    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          // Timeout — try once more
          if (socket?.connected) {
            socket.emit('join:session', { sessionId });
          }
          resolve(socket?.connected ?? false);
        }
      }, 3000);

      socket!.emit('join:session', { sessionId }, (response: any) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        if (response?.success) {
          resolve(true);
        } else {
          console.warn(`[Socket] join:session failed: ${response?.error} — retrying...`);
          // Retry up to 2 more times with backoff
          let retries = 0;
          const retryJoin = () => {
            retries++;
            if (retries > 2 || currentSessionId !== sessionId || !socket?.connected) {
              resolve(false);
              return;
            }
            setTimeout(() => {
              if (currentSessionId !== sessionId || !socket?.connected) {
                resolve(false);
                return;
              }
              socket!.emit('join:session', { sessionId }, (res: any) => {
                if (res?.success) {
                  resolve(true);
                } else {
                  retryJoin();
                }
              });
            }, 1000 * retries);
          };
          retryJoin();
        }
      });
    });
  },

  /** Synchronous join (fire-and-forget) — for backward compatibility */
  joinSession(sessionId: string) {
    this.joinSessionAsync(sessionId);
  },

  /** Re-join the current session room (e.g. after app foreground) */
  rejoinCurrentSession() {
    if (currentSessionId) {
      // Use async join with retry — don't rely on synchronous check
      this.joinSessionAsync(currentSessionId);
    }
  },

  cancelRun(sessionId: string) {
    this.ensureConnected();
    socket?.emit('cancel:run', { sessionId });
  },

  onStream(cb: (event: any) => void) {
    streamListeners.add(cb);
    return () => { streamListeners.delete(cb); };
  },

  onTyping(cb: (data: any) => void) {
    typingListeners.add(cb);
    return () => { typingListeners.delete(cb); };
  },

  /** Listen to raw socket events (connect, disconnect, etc.) — survives reconnection */
  on(event: string, cb: (...args: any[]) => void): () => void {
    if (!genericListeners.has(event)) genericListeners.set(event, new Set());
    genericListeners.get(event)!.add(cb);
    socket?.on(event, cb);
    return () => {
      genericListeners.get(event)?.delete(cb);
      socket?.off(event, cb);
    };
  },

  isConnected(): boolean {
    return socket?.connected ?? false;
  },

  disconnect() {
    currentSessionId = null;
    currentToken = null;
    isConnecting = false;
    clearHeartbeatTimer();
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
    connectResolve = null;
    // Clear persistent registries to prevent orphan listeners after logout
    streamListeners.clear();
    typingListeners.clear();
    genericListeners.clear();
  },

  /** Update stored token without disconnecting — used for token refresh during active streams */
  _updateToken(newToken: string) {
    currentToken = newToken;
    // Update auth for next reconnection attempt
    if (socket) {
      socket.auth = { token: newToken };
    }
  },

  getSocket() {
    return socket;
  },
};
