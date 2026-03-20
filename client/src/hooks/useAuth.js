import { useState, useCallback } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
const STORAGE_KEY = 'chess_auth'

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function useAuth() {
  const [auth, setAuth] = useState(() => loadStored())
  // auth shape: { token, user: { id, username, ratings, wins, losses, draws } }
  // null = not logged in (guest)

  const persist = useCallback((data) => {
    if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    else localStorage.removeItem(STORAGE_KEY)
    setAuth(data)
  }, [])

  const register = useCallback(async (username, password) => {
    const res = await fetch(`${SERVER_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error }
    persist(data)
    return { ok: true }
  }, [persist])

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${SERVER_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error }
    persist(data)
    return { ok: true }
  }, [persist])

  const logout = useCallback(() => {
    persist(null)
  }, [persist])

  const updateRatings = useCallback((ratingChanges, timeControl) => {
    if (!auth?.user) return
    const updated = { ...auth }
    if (ratingChanges?.white !== null || ratingChanges?.black !== null) {
      // We don't know which color we were here — caller should pass delta directly
    }
    // Refresh user from server after a rated game
    fetch(`${SERVER_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then(r => r.json())
      .then(user => {
        if (user._id) persist({ ...auth, user: { ...auth.user, ratings: user.ratings, wins: user.wins, losses: user.losses, draws: user.draws } })
      })
      .catch(() => {})
  }, [auth, persist])

  return {
    auth,
    isGuest: !auth,
    user: auth?.user ?? null,
    token: auth?.token ?? null,
    register,
    login,
    logout,
    updateRatings,
  }
}
