import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

type EventHandler = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<EventHandler>>();

  async connect() {
    if (this.socket?.connected) return;

    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return;

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    this.socket.on('connect', () => {
      if (__DEV__) console.log('[Socket] Connected');
    });

    this.socket.on('disconnect', (reason) => {
      if (__DEV__) console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      if (__DEV__) console.log('[Socket] Connection error:', err.message);
    });

    for (const [event, handlers] of this.listeners) {
      for (const handler of handlers) {
        this.socket.on(event, handler);
      }
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
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
