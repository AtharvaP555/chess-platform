import { useState } from 'react'

export default function AuthScreen({ onLogin, onRegister, onGuest }) {
  const [tab, setTab] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields')
      return
    }
    setLoading(true)
    setError('')
    const result = tab === 'login'
      ? await onLogin(username.trim(), password)
      : await onRegister(username.trim(), password)
    if (result?.error) setError(result.error)
    setLoading(false)
  }

  return (
    <div className="auth-screen">
      <div className="auth-hero">
        <h1>♞ CHESS</h1>
        <p className="lobby-subtitle">Real-time multiplayer</p>
      </div>

      <div className="card auth-card">
        {/* Tab switcher */}
        <div className="lobby-tabs" style={{ marginBottom: 20 }}>
          <button
            className={`lobby-tab ${tab === 'login' ? 'lobby-tab-active' : ''}`}
            onClick={() => { setTab('login'); setError('') }}
          >
            Login
          </button>
          <button
            className={`lobby-tab ${tab === 'register' ? 'lobby-tab-active' : ''}`}
            onClick={() => { setTab('register'); setError('') }}
          >
            Register
          </button>
        </div>

        <div className="auth-fields">
          <input
            className="auth-input"
            type="text"
            placeholder="Username"
            value={username}
            maxLength={20}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoFocus
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          {error && <span className="lobby-error">{error}</span>}
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Please wait…' : tab === 'login' ? 'Login' : 'Create Account'}
          </button>
        </div>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button className="btn btn-secondary" onClick={onGuest}>
          Continue as Guest
        </button>
        <p className="auth-guest-note">
          Guest games are not saved to your profile and don't affect ratings
        </p>
      </div>
    </div>
  )
}
