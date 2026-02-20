import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config';

type EventHandler = (data: any) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<EventHandler>>();
  private connecting = false;

  async connect() {
    // Если уже подключен, не делаем ничего
    if (this.socket?.connected) return;
    
    // Если уже идет подключение, ждем
    if (this.connecting) return;
    
    // Если сокет существует но не подключен, отключаем его перед созданием нового
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return;

    this.connecting = true;

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
      upgrade: true,
      forceNew: false, // Переиспользуем соединение если возможно
    });

    this.socket.on('connect', () => {
      this.connecting = false;
      if (__DEV__) console.log('[Socket] Connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.connecting = false;
      if (__DEV__) console.log('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      this.connecting = false;
      if (__DEV__) console.log('[Socket] Connection error:', err.message);
    });

    for (const [event, handlers] of this.listeners) {
      for (const handler of handlers) {
        this.socket.on(event, handler);
      }
    }
  }

  disconnect() {
    this.connecting = false;
    this.socket?.removeAllListeners();
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
