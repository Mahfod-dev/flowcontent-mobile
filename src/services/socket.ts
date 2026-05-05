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
      if (currentSessionId) {
        socket?.emit('join:session', { sessionId: currentSessionId });
      }
      // Start heartbeat watchdog
      resetHeartbeatTimer();
    });
    socket.on('disconnect', (reason) => {
      isConnecting = false;
      console.log('[Socket] Disconnected:', reason);
      clearHeartbeatTimer();
    });
    socket.on('connect_error', (err) => {
      isConnecting = false;
      console.warn('[Socket] Error:', err.message);
    });
    // Any incoming event resets the heartbeat timer
    socket.onAny(() => { resetHeartbeatTimer(); });

    return socket;
  },

  /** Ensure socket is alive — force reconnect if stale */
  ensureConnected(): boolean {
    if (socket?.connected) return true;
    if (currentToken) {
      this.connect(currentToken);
    }
    return socket?.connected ?? false;
  },

  joinSession(sessionId: string) {
    // Leave previous session room to prevent stream event leaks
    if (currentSessionId && currentSessionId !== sessionId && socket?.connected) {
      socket.emit('leave:session', { sessionId: currentSessionId });
    }
    currentSessionId = sessionId;
    this.ensureConnected();
    if (socket?.connected) {
      socket.emit('join:session', { sessionId });
    }
  },

  /** Re-join the current session room (e.g. after app foreground) */
  rejoinCurrentSession() {
    if (currentSessionId && socket?.connected) {
      socket.emit('join:session', { sessionId: currentSessionId });
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
    // Clear persistent registries to prevent orphan listeners after logout
    streamListeners.clear();
    typingListeners.clear();
    genericListeners.clear();
  },

  getSocket() {
    return socket;
  },
};
