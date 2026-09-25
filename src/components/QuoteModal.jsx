import React, { useEffect, useState } from 'react';
import { Check, X, ArrowUpRight } from 'lucide-react';
import { T } from '../shared';
import { apiGet } from '../lib/api';

export default function QuoteModal({ open, onClose, picked, toggle, quoteName, setQuoteName, quoteContact, setQuoteContact, send, sent }) {
  const [services, setServices] = useState([]);

  useEffect(() => {
    if (open) apiGet('/api/services', { auth: false }).then(setServices).catch((err) => console.error('failed to load services', err));
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-5 overflow-y-auto"
      style={{ background: 'var(--scrim)', backdropFilter: 'blur(6px)' }}
      onClick={() => !sent && onClose()}
    >
      <div
        className="w-full max-w-md rounded-3xl p-8 relative my-8"
        style={{ background: T.surface, border: `1px solid ${T.line}`, boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={() => onClose()} className="absolute top-5 right-5 hover:text-[color:var(--text)] transition-colors" style={{ color: T.muted }}>
          <X size={18} />
        </button>
        {!sent ? (
          <>
            <div className="inline-flex items-center gap-3 text-[11px] tracking-[0.22em] uppercase mb-5" style={{ fontFamily: "'JetBrains Mono', monospace", color: T.daylight }}>
              Quotation request
            </div>
            <h3 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl mb-7 leading-tight">Tell us what you need shot.</h3>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {services.map((s) => {
                const on = picked.includes(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => toggle(s.key)}
                    className="text-xs px-3 py-3 rounded-xl border text-left flex items-center gap-2 transition-all"
                    style={{
                      borderColor: on ? T.stream : T.line,
                      background: on ? 'rgba(240,54,42,.10)' : 'transparent',
                      color: on ? T.stream : T.muted,
                    }}
                  >
                    {on && <Check size={12} />} {s.label}
                  </button>
                );
              })}
            </div>
            <div className="space-y-3 mb-7">
              <input
                placeholder="Your name"
                value={quoteName}
                onChange={(e) => setQuoteName(e.target.value)}
                className="w-full text-sm px-4 py-3.5 rounded-xl outline-none focus:border-[color:var(--muted)] transition-colors"
                style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}
              />
              <input
                placeholder="WhatsApp number or email"
                value={quoteContact}
                onChange={(e) => setQuoteContact(e.target.value)}
                className="w-full text-sm px-4 py-3.5 rounded-xl outline-none focus:border-[color:var(--muted)] transition-colors"
                style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}
              />
            </div>
            <button
              onClick={send}
              disabled={picked.length === 0}
              className="w-full py-3.5 rounded-full text-sm font-medium flex items-center justify-center gap-2 transition-all"
              style={{
                background: T.stream,
                color: T.bg,
                opacity: picked.length === 0 ? .35 : 1,
                boxShadow: picked.length === 0 ? 'none' : '0 0 30px rgba(240,54,42,.35)',
              }}
            >
              Send request <ArrowUpRight size={15} />
            </button>
          </>
        ) : (
          <div className="py-12 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
              style={{ background: 'rgba(240,54,42,.14)', border: '1px solid rgba(240,54,42,.3)' }}>
              <Check size={22} style={{ color: T.stream }} />
            </div>
            <p className="font-medium mb-1.5 text-lg">Request sent</p>
            <p className="text-sm" style={{ color: T.muted }}>We'll send your quote by WhatsApp or email shortly.</p>
          </div>
        )}
      </div>
    </div>
  );
}
