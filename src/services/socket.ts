import { io, Socket } from 'socket.io-client';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://flowbackendapi.store';

let socket: Socket | null = null;
let currentSessionId: string | null = null;
let isConnecting = false;

// Persistent listener registries — survive socket recreation
const streamListeners = new Set<(event: any) => void>();
const typingListeners = new Set<(data: any) => void>();

function attachListenersToSocket(s: Socket) {
  s.on('chat:stream', (event: any) => {
    streamListeners.forEach((cb) => cb(event));
  });
  s.on('chat:typing', (data: any) => {
    typingListeners.forEach((cb) => cb(data));
  });
}

export const socketService = {
  connect(token: string): Socket {
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
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 15000,
    });

    attachListenersToSocket(socket);

    socket.on('connect', () => {
      isConnecting = false;
      console.log('[Socket] Connected:', socket?.id);
      if (currentSessionId) {
        socket?.emit('join:session', { sessionId: currentSessionId });
      }
    });
    socket.on('disconnect', (reason) => {
      isConnecting = false;
      console.log('[Socket] Disconnected:', reason);
    });
    socket.on('connect_error', (err) => {
      console.warn('[Socket] Error:', err.message);
    });

    return socket;
  },

  joinSession(sessionId: string) {
    currentSessionId = sessionId;
    if (socket?.connected) {
      socket.emit('join:session', { sessionId });
    }
  },

  cancelRun(sessionId: string) {
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

  isConnected(): boolean {
    return socket?.connected ?? false;
  },

  disconnect() {
    currentSessionId = null;
    isConnecting = false;
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
  },

  getSocket() {
    return socket;
  },
};
