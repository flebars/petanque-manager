import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/authStore';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'http://localhost:3000';

let socket: Socket | null = null;

export function useSocket(concoursId: string | null): Socket | null {
  const token = useAuthStore((s) => s.accessToken);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!concoursId) return;

    if (!socket) {
      socket = io(WS_URL, { auth: { token } });
    }
    socketRef.current = socket;
    socket.emit('joinConcours', concoursId);

    return () => {
      socket?.emit('leaveConcours', concoursId);
    };
  }, [concoursId, token]);

  return socketRef.current;
}
