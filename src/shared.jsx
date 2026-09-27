import React, { useEffect } from 'react';
import logoUrl from './assets/logo.png';
import logoLightThemeUrl from './assets/logo-light-theme.png';

export const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes pulseDot { 0%,100% { opacity:1; transform:scale(1);} 50% { opacity:.35; transform:scale(.8);} }
@keyframes floatSlow { 0%,100% { transform: translateY(0px);} 50% { transform: translateY(-14px);} }
@keyframes grainShift {
  0%,100% { transform: translate(0,0); }
  20% { transform: translate(-3%,2%); }
  40% { transform: translate(2%,-3%); }
  60% { transform: translate(-2%,-2%); }
  80% { transform: translate(3%,3%); }
}
@keyframes sweep { from { background-position: -180% 0; } to { background-position: 280% 0; } }

.reveal { opacity: 0; transform: translateY(28px); transition: opacity .9s cubic-bezier(.2,.7,.2,1), transform .9s cubic-bezier(.2,.7,.2,1); }
.reveal.in { opacity: 1; transform: none; }

.workcard img, .workcard .scrim { transition: transform .7s cubic-bezier(.2,.7,.2,1); }
.workcard:hover .zoomer { transform: scale(1.07); }
.workcard:hover .scrubfill { width: 100%; }
.scrubfill { transition: width 2.4s linear; }

.shine {
  background-image: linear-gradient(100deg, transparent 20%, var(--shine) 45%, transparent 70%);
  background-size: 200% 100%;
  animation: sweep 5s linear infinite;
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
  .reveal { opacity:1 !important; transform:none !important; }
}
`;

// Design tokens resolve to CSS variables (defined per theme in src/index.css),
// so every existing `style={{ background: T.bg }}` follows light/dark mode.
// Because they're `var(...)` strings, don't append hex alpha (`T.stream + '33'`)
// or pass them to libraries that need a literal color — use BRAND_HEX for that,
// or color-mix() for tints.
// Temporarily hidden on the public site at the user's request (2026-09-27).
// Flip back to true to bring back the homepage Events section and the
// "Events" nav link (Navbar.jsx) — ticketed events still work fully in the
// admin either way, this only affects public visibility.
export const SHOW_TICKETED_EVENTS = false;

export const T = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surfaceAlt: 'var(--surface-alt)',
  stream: 'var(--stream)',
  ember: 'var(--ember)',
  daylight: 'var(--daylight)',
  text: 'var(--text)',
  muted: 'var(--muted)',
  line: 'var(--line)',
};

export const BRAND_HEX = '#F0362A';

export const FILTERS = [
  { key: "all", label: "All work" },
  { key: "corporate", label: "Corporate" },
  { key: "product", label: "Product" },
  { key: "video", label: "Video" },
  { key: "post", label: "Post Production" },
];

export const STATS = [
  { n: "480+", l: "Shoot days a year" },
  { n: "12", l: "Cameras in rotation" },
  { n: "6", l: "Cities covered" },
  { n: "48h", l: "Typical first cut" },
];

export const SRC_LABEL = {
  website: "Booked — Website",
  instagram: "Booked — Instagram",
  whatsapp: "Booked — WhatsApp",
  facebook: "Booked — Facebook",
  manual: "Booked — Studio hold",
};
export const SRC_DOT = {
  website: T.stream,
  instagram: "#E0568F",
  whatsapp: "#57C07A",
  facebook: T.daylight,
  manual: T.muted,
};

export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

// The PNG wordmark ("media" is baked into the artwork). Two variants —
// white lettering for dark mode, dark lettering for light mode — swapped
// with CSS (see .logo-on-dark / .logo-on-light in src/index.css).
export function Logo({ size = 'md' }) {
  const height = size === 'lg' ? 68 : size === 'sm' ? 36 : 54;
  return (
    <>
      <img className="logo-on-dark" src={logoUrl} alt="Thunderstream Media" style={{ height, width: 'auto' }} />
      <img className="logo-on-light" src={logoLightThemeUrl} alt="" aria-hidden style={{ height, width: 'auto' }} />
    </>
  );
}

export function Eyebrow({ children, color = T.stream }) {
  return (
    <div
      className="inline-flex items-center gap-3 text-[11px] tracking-[0.22em] uppercase mb-5"
      style={{ fontFamily: "'JetBrains Mono', monospace", color }}
    >
      <span className="w-6 h-px" style={{ background: color }} />
      {children}
    </div>
  );
}

export function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{
        opacity: 'var(--grain-opacity)',
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        animation: 'grainShift 900ms steps(3) infinite',
        mixBlendMode: 'overlay',
      }}
    />
  );
}

export function Aperture({ open }) {
  const blades = 10;
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="none" className="w-full h-full absolute inset-0" style={{ pointerEvents: 'none' }}>
      {Array.from({ length: blades }).map((_, i) => {
        const angle = (360 / blades) * i;
        return (
          <polygon
            key={i}
            points="200,200 360,120 360,280"
            fill={T.bg}
            style={{
              transformOrigin: '200px 200px',
              transform: `rotate(${angle}deg) ${open ? 'translateX(260px) scale(1.6)' : 'translateX(0) scale(1)'}`,
              transition: `transform 1.25s cubic-bezier(.76,0,.24,1) ${i * 0.028}s, opacity .6s ease ${0.5 + i * 0.02}s`,
              opacity: open ? 0 : 1,
            }}
          />
        );
      })}
    </svg>
  );
}

export default {};
