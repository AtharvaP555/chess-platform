import { useEffect, useRef, useCallback, useState } from "react";
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

export function useSocket(token = null) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      autoConnect: true,
      auth: { token }, // ← JWT sent on handshake, null for guests
    });
    socketRef.current = socket;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    return () => socket.disconnect();
  }, [token]); // re-connect if token changes (login/logout)

  const emit = useCallback((event, data, callback) => {
    if (!socketRef.current) return;
    if (callback) socketRef.current.emit(event, data, callback);
    else socketRef.current.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  return { socket: socketRef, connected, emit, on };
}
