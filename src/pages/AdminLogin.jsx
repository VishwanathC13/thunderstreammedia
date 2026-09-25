import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { T, FONT_IMPORT, Logo } from '../shared';
import ThemeToggle from '../components/ThemeToggle';

export default function AdminLogin() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && user) return <Navigate to="/admin" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-5" style={{ background: T.bg, color: T.text, fontFamily: "'Space Grotesk', sans-serif" }}>
      <style>{FONT_IMPORT}</style>
      <div className="absolute top-5 right-5"><ThemeToggle /></div>
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl p-8" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size="lg" />
          <div className="text-xs tracking-[.2em] uppercase mt-4" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Admin sign in</div>
        </div>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(229,98,45,.12)', color: T.ember, border: '1px solid rgba(229,98,45,.3)' }}>
            {error}
          </div>
        )}

        <label className="block text-xs mb-2" style={{ color: T.muted }}>Username</label>
        <input
          type="text"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-5 px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}
        />

        <label className="block text-xs mb-2" style={{ color: T.muted }}>Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-7 px-4 py-3 rounded-xl text-sm outline-none"
          style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-full font-medium transition-all hover:scale-[1.02] disabled:opacity-60"
          style={{ background: T.stream, color: T.bg }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
