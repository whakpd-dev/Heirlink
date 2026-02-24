import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';
import { tokenStorage } from './tokenStorage';

type EventHandler = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<EventHandler>>();
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async connect() {
    if (this.socket?.connected) return;
    if (this.connecting) return;

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const token = await tokenStorage.getAccessToken();
    if (!token) return;

    this.connecting = true;

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
      upgrade: true,
      forceNew: false,
    });

    this.socket.on('connect', () => {
      this.connecting = false;
      if (__DEV__) console.log('[Socket] Connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.connecting = false;
      if (__DEV__) console.log('[Socket] Disconnected:', reason);
      if (reason === 'io server disconnect') {
        this.scheduleReconnectWithFreshToken();
      }
    });

    this.socket.on('connect_error', (err) => {
      this.connecting = false;
      if (__DEV__) console.log('[Socket] Connection error:', err.message);
      if (err.message?.includes('jwt') || err.message?.includes('unauthorized')) {
        this.scheduleReconnectWithFreshToken();
      }
    });

    for (const [event, handlers] of this.listeners) {
      for (const handler of handlers) {
        this.socket.on(event, handler);
      }
    }
  }

  private scheduleReconnectWithFreshToken() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      this.disconnect();
      await this.connect();
    }, 3000);
  }

  disconnect() {
    this.connecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const handlers = this.listeners.get(event)!;
    if (handlers.has(handler)) return () => this.off(event, handler);
    handlers.add(handler);
    this.socket?.on(event, handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: EventHandler) {
    this.listeners.get(event)?.delete(handler);
    this.socket?.off(event, handler);
  }

  emit(event: string, data: any) {
    this.socket?.emit(event, data);
  }

  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const socketService = new SocketService();
