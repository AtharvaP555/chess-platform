import { useState, useCallback } from "react";

const STORAGE_KEY = "chess_session";

export function useGameSession() {
  const [session, setSessionState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const saveSession = useCallback((roomId, color) => {
    const data = { roomId, color };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSessionState(data);
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSessionState(null);
  }, []);

  return { session, saveSession, clearSession };
}
