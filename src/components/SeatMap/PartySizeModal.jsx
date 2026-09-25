import React from 'react';
import { T } from '../../shared';

// Group illustration per party size, ported verbatim from the
// seat-booking-system demo (public/index.html PARTY_ICONS) — plain
// currentColor SVG paths, just recolored via the theme instead of amber.
const PARTY_ICONS = {
  1: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28" role="img" aria-label="Party of 1">
    <path d="M24,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM19.5,16.5a4.5,4.5 0 0,1 9,0L28.5,26L19.5,26z"></path>
  </svg>`,
  2: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28" role="img" aria-label="Party of 2">
    <path d="M18.9,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM14.4,16.5a4.5,4.5 0 0,1 9,0L23.4,26L14.4,26z"></path>
    <path d="M29.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM24.6,16.5a4.5,4.5 0 0,1 9,0L33.6,26L24.6,26z"></path>
  </svg>`,
  3: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28" role="img" aria-label="Party of 3">
    <path d="M15,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM10.5,16.5a4.5,4.5 0 0,1 9,0L19.5,26L10.5,26z"></path>
    <path d="M25.2,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM20.7,16.5a4.5,4.5 0 0,1 9,0L29.7,26L20.7,26z"></path>
    <path d="M34.2,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM30.9,19.5a3.3,3.3 0 0,1 6.6,0L37.5,26L30.9,26z"></path>
  </svg>`,
  4: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28" role="img" aria-label="Party of 4">
    <path d="M11.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM6.6,16.5a4.5,4.5 0 0,1 9,0L15.6,26L6.6,26z"></path>
    <path d="M21.3,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM16.8,16.5a4.5,4.5 0 0,1 9,0L25.8,26L16.8,26z"></path>
    <path d="M30.3,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM27,19.5a3.3,3.3 0 0,1 6.6,0L33.6,26L27,26z"></path>
    <path d="M38.1,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM34.8,19.5a3.3,3.3 0 0,1 6.6,0L41.4,26L34.8,26z"></path>
  </svg>`,
  5: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28" role="img" aria-label="Party of 5">
    <g transform="translate(25.5 19) scale(0.78) translate(-24 -26)">
      <path d="M24,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM19.5,16.5a4.5,4.5 0 0,1 9,0L28.5,26L19.5,26z" fill="var(--guest-fill, currentColor)"></path>
    </g>
    <path d="M11.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM6.6,16.5a4.5,4.5 0 0,1 9,0L15.6,26L6.6,26z"></path>
    <path d="M21.3,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM16.8,16.5a4.5,4.5 0 0,1 9,0L25.8,26L16.8,26z"></path>
    <path d="M30.3,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM27,19.5a3.3,3.3 0 0,1 6.6,0L33.6,26L27,26z"></path>
    <path d="M38.1,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM34.8,19.5a3.3,3.3 0 0,1 6.6,0L41.4,26L34.8,26z"></path>
  </svg>`,
  6: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28" role="img" aria-label="Party of 6">
    <g transform="translate(25.5 19) scale(0.78) translate(-24 -26)">
      <path d="M18.9,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM14.4,16.5a4.5,4.5 0 0,1 9,0L23.4,26L14.4,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M29.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM24.6,16.5a4.5,4.5 0 0,1 9,0L33.6,26L24.6,26z" fill="var(--guest-fill, currentColor)"></path>
    </g>
    <path d="M11.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM6.6,16.5a4.5,4.5 0 0,1 9,0L15.6,26L6.6,26z"></path>
    <path d="M21.3,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM16.8,16.5a4.5,4.5 0 0,1 9,0L25.8,26L16.8,26z"></path>
    <path d="M30.3,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM27,19.5a3.3,3.3 0 0,1 6.6,0L33.6,26L27,26z"></path>
    <path d="M38.1,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM34.8,19.5a3.3,3.3 0 0,1 6.6,0L41.4,26L34.8,26z"></path>
  </svg>`,
  7: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28" role="img" aria-label="Party of 7">
    <g transform="translate(25.5 19) scale(0.78) translate(-24 -26)">
      <path d="M13.8,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM9.3,16.5a4.5,4.5 0 0,1 9,0L18.3,26L9.3,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M24,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM19.5,16.5a4.5,4.5 0 0,1 9,0L28.5,26L19.5,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M34.2,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM29.7,16.5a4.5,4.5 0 0,1 9,0L38.7,26L29.7,26z" fill="var(--guest-fill, currentColor)"></path>
    </g>
    <path d="M11.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM6.6,16.5a4.5,4.5 0 0,1 9,0L15.6,26L6.6,26z"></path>
    <path d="M21.3,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM16.8,16.5a4.5,4.5 0 0,1 9,0L25.8,26L16.8,26z"></path>
    <path d="M30.3,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM27,19.5a3.3,3.3 0 0,1 6.6,0L33.6,26L27,26z"></path>
    <path d="M38.1,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM34.8,19.5a3.3,3.3 0 0,1 6.6,0L41.4,26L34.8,26z"></path>
  </svg>`,
  8: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28" role="img" aria-label="Party of 8">
    <g transform="translate(25.5 19) scale(0.78) translate(-24 -26)">
      <path d="M11.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM6.6,16.5a4.5,4.5 0 0,1 9,0L15.6,26L6.6,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M21.3,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM16.8,16.5a4.5,4.5 0 0,1 9,0L25.8,26L16.8,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M30.3,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM27,19.5a3.3,3.3 0 0,1 6.6,0L33.6,26L27,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M38.1,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM34.8,19.5a3.3,3.3 0 0,1 6.6,0L41.4,26L34.8,26z" fill="var(--guest-fill, currentColor)"></path>
    </g>
    <path d="M11.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM6.6,16.5a4.5,4.5 0 0,1 9,0L15.6,26L6.6,26z"></path>
    <path d="M21.3,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM16.8,16.5a4.5,4.5 0 0,1 9,0L25.8,26L16.8,26z"></path>
    <path d="M30.3,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM27,19.5a3.3,3.3 0 0,1 6.6,0L33.6,26L27,26z"></path>
    <path d="M38.1,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM34.8,19.5a3.3,3.3 0 0,1 6.6,0L41.4,26L34.8,26z"></path>
  </svg>`,
  9: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28" role="img" aria-label="Party of 9">
    <g transform="translate(25.5 19) scale(0.78) translate(-24 -26)">
      <path d="M6,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM1.5,16.5a4.5,4.5 0 0,1 9,0L10.5,26L1.5,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M16.2,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM11.7,16.5a4.5,4.5 0 0,1 9,0L20.7,26L11.7,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M25.2,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM21.9,19.5a3.3,3.3 0 0,1 6.6,0L28.5,26L21.9,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M33,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM29.7,19.5a3.3,3.3 0 0,1 6.6,0L36.3,26L29.7,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M42,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM37.5,16.5a4.5,4.5 0 0,1 9,0L46.5,26L37.5,26z" fill="var(--guest-fill, currentColor)"></path>
    </g>
    <path d="M11.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM6.6,16.5a4.5,4.5 0 0,1 9,0L15.6,26L6.6,26z"></path>
    <path d="M21.3,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM16.8,16.5a4.5,4.5 0 0,1 9,0L25.8,26L16.8,26z"></path>
    <path d="M30.3,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM27,19.5a3.3,3.3 0 0,1 6.6,0L33.6,26L27,26z"></path>
    <path d="M38.1,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM34.8,19.5a3.3,3.3 0 0,1 6.6,0L41.4,26L34.8,26z"></path>
  </svg>`,
  10: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28" role="img" aria-label="Party of 10">
    <g transform="translate(25.5 19) scale(0.78) translate(-24 -26)">
      <path d="M0.9,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM-3.6,16.5a4.5,4.5 0 0,1 9,0L5.4,26L-3.6,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M11.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM6.6,16.5a4.5,4.5 0 0,1 9,0L15.6,26L6.6,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M20.1,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM16.8,19.5a3.3,3.3 0 0,1 6.6,0L23.4,26L16.8,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M27.9,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM24.6,19.5a3.3,3.3 0 0,1 6.6,0L31.2,26L24.6,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M36.9,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM32.4,16.5a4.5,4.5 0 0,1 9,0L41.4,26L32.4,26z" fill="var(--guest-fill, currentColor)"></path>
      <path d="M47.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM42.6,16.5a4.5,4.5 0 0,1 9,0L51.6,26L42.6,26z" fill="var(--guest-fill, currentColor)"></path>
    </g>
    <path d="M11.1,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM6.6,16.5a4.5,4.5 0 0,1 9,0L15.6,26L6.6,26z"></path>
    <path d="M21.3,4.8a3.2,3.2 0 1,0 0,6.4a3.2,3.2 0 1,0 0,-6.4zM16.8,16.5a4.5,4.5 0 0,1 9,0L25.8,26L16.8,26z"></path>
    <path d="M30.3,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM27,19.5a3.3,3.3 0 0,1 6.6,0L33.6,26L27,26z"></path>
    <path d="M38.1,10.6a2.4,2.4 0 1,0 0,4.8a2.4,2.4 0 1,0 0,-4.8zM34.8,19.5a3.3,3.3 0 0,1 6.6,0L41.4,26L34.8,26z"></path>
  </svg>`,
};

// zones: [{ id, name, colorHex, price, total, available }]
export default function PartySizeModal({ open, maxSeats, onChangeMaxSeats, zones, onConfirm }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(4,5,9,.72)' }}
    >
      <div
        className="rounded-3xl w-full text-center overflow-hidden"
        style={{ background: T.surface, border: `1px solid ${T.line}`, maxWidth: 560 }}
      >
        <div className="pt-8 px-8">
          <h2 style={{ fontFamily: "'Fraunces', serif" }} className="text-2xl mb-1">How many seats?</h2>
          <p className="text-xs" style={{ color: T.muted }}>Pick a party size — we'll auto-fill the rest around your first pick.</p>
        </div>

        <div
          className="flex justify-center my-4"
          style={{ color: T.stream }}
          dangerouslySetInnerHTML={{ __html: PARTY_ICONS[maxSeats] || PARTY_ICONS[1] }}
        />

        <div className="flex justify-center gap-2 my-5 flex-wrap px-6">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
            const active = n === maxSeats;
            return (
              <button
                key={n}
                onClick={() => onChangeMaxSeats(n)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm transition-colors"
                style={{
                  background: active ? T.stream : 'transparent',
                  color: active ? T.bg : T.text,
                  border: `1px solid ${active ? T.stream : T.line}`,
                }}
              >
                {n}
              </button>
            );
          })}
        </div>

        <div style={{ borderTop: `1px solid ${T.line}` }} />

        <div className="flex gap-6 overflow-x-auto px-8 py-4 text-left" style={{ scrollbarWidth: 'none' }}>
          {zones.map((z) => {
            const ratio = z.total === 0 ? 0 : z.available / z.total;
            let statusText, statusColor;
            if (z.available === 0) { statusText = 'Sold out'; statusColor = T.muted; }
            else if (ratio < 0.3) { statusText = 'Filling fast'; statusColor = T.ember; }
            else { statusText = 'Available'; statusColor = '#4ade80'; }
            return (
              <div key={z.id} className="shrink-0" style={{ minWidth: 108 }}>
                <div className="text-[10px] tracking-[.15em] uppercase mb-1.5" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                  {z.name}
                </div>
                <div className="text-lg mb-1" style={{ fontFamily: "'JetBrains Mono', monospace", color: T.text }}>
                  ₹{z.price}
                </div>
                <div className="text-[11px] font-medium" style={{ color: statusColor }}>{statusText}</div>
              </div>
            );
          })}
        </div>

        <div className="mx-8 my-4 px-4 py-3 rounded-xl text-xs text-left" style={{ background: 'rgba(240,54,42,.08)', border: `1px solid ${T.line}`, color: T.muted }}>
          <strong style={{ color: T.stream }}>Tip:</strong> pick any seat and we'll auto-fill the rest of your party around it.
        </div>

        <button
          onClick={onConfirm}
          className="block w-[calc(100%-64px)] mx-8 mb-8 py-3.5 rounded-full text-sm font-medium"
          style={{ background: T.stream, color: T.bg }}
        >
          Select seats
        </button>
      </div>
    </div>
  );
}
