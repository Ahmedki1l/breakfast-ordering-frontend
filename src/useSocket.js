import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useSocket(sessionId, { onUpdate, onClosed } = {}) {
  const socketRef = useRef(null);

  const connect = useCallback(() => {
    if (!sessionId || socketRef.current) return;

    const serverUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      socket.emit('join-session', sessionId);
    });

    if (onUpdate) {
      socket.on('session-updated', onUpdate);
    }

    if (onClosed) {
      socket.on('session-closed', onClosed);
    }

    socketRef.current = socket;
  }, [sessionId, onUpdate, onClosed]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  return socketRef;
}
