import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Radio } from 'lucide-react';
import { T, Logo } from '../shared';
import { apiGet } from '../lib/api';
import ThemeToggle from './ThemeToggle';

export default function Navbar({ solid, onRequestQuote }) {
  const [liveEvent, setLiveEvent] = useState(null);

  useEffect(() => {
    const checkLive = () => {
      apiGet('/api/events/live', { auth: false })
        .then((data) => setLiveEvent(data.live ? data.event : null))
        .catch((err) => console.error('failed to check live status', err));
    };
    checkLive();
    const interval = setInterval(checkLive, 45000);
    return () => clearInterval(interval);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 md:px-10 py-4 transition-all duration-300"
      style={{
        background: solid ? 'var(--nav-solid)' : 'transparent',
        backdropFilter: solid ? 'blur(14px)' : 'none',
        borderBottom: `1px solid ${solid ? T.line : 'transparent'}`,
      }}
    >
      <Logo />
      <div className="hidden md:flex items-center gap-9 text-sm" style={{ color: T.muted }}>
        {['Work', 'Services', 'Booking', 'Events'].map((x) => (
          <a key={x} href={`#${x.toLowerCase()}`} className="relative hover:text-[color:var(--text)] transition-colors group">
            {x}
            <span className="absolute -bottom-1 left-0 w-0 h-px group-hover:w-full transition-all duration-300" style={{ background: T.stream }} />
          </a>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {liveEvent && (
          <Link
            to={`/events/${liveEvent.slug}`}
            className="hidden sm:flex items-center gap-2 text-xs px-4 py-2.5 rounded-full font-medium transition-all hover:scale-105"
            style={{ background: 'rgba(240,54,42,.14)', color: T.stream, border: '1px solid rgba(240,54,42,.35)' }}
            title={liveEvent.title}
          >
            <Radio size={13} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.stream, animation: 'pulseDot 1.4s ease-in-out infinite' }} />
            LIVE NOW
          </Link>
        )}
        <ThemeToggle />
        <button
          onClick={onRequestQuote}
          className="text-sm px-5 py-2.5 rounded-full font-medium transition-all hover:scale-105"
          style={{ background: T.stream, color: T.bg, boxShadow: `0 0 28px rgba(240,54,42,.35)` }}
        >
          Get a quote
        </button>
      </div>
    </nav>
  );
}
