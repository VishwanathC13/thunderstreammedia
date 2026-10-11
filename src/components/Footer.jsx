import React from 'react';
import { Instagram, Facebook, Youtube } from 'lucide-react';
import { T, Logo } from '../shared';

export default function Footer() {
  return (
    <footer className="px-5 md:px-10 py-16" style={{ borderTop: `1px solid ${T.line}` }}>
      <div className="flex flex-col md:flex-row justify-between gap-10">
        <div>
          <Logo size="lg" showTagline />
          <p className="text-sm mt-4 max-w-xs" style={{ color: T.muted }}>
            Full-service production — video, photo, live, post production, product, corporate.
          </p>
        </div>
        <div className="flex gap-12 text-sm" style={{ color: T.muted }}>
          <div className="flex flex-col gap-2.5">
            <span style={{ color: T.text }}>Contact</span>
            <a href="https://thunderstreammedia.com" className="hover:text-[color:var(--text)] transition-colors">thunderstreammedia.com</a>
            <a href="tel:+918884010884" className="hover:text-[color:var(--text)] transition-colors">+91 88840 10884</a>
          </div>
          <div className="flex flex-col gap-2.5">
            <span style={{ color: T.text }}>Follow</span>
            <a href="https://www.instagram.com/thunderstreammedia" target="_blank" rel="noopener noreferrer" className="hover:text-[color:var(--text)] transition-colors flex items-center gap-2"><Instagram size={14} /> Instagram</a>
            <a href="https://www.facebook.com/share/1KUu3mQuYU/" target="_blank" rel="noopener noreferrer" className="hover:text-[color:var(--text)] transition-colors flex items-center gap-2"><Facebook size={14} /> Facebook</a>
            <a href="https://youtube.com/@thunderstreammedia9516" target="_blank" rel="noopener noreferrer" className="hover:text-[color:var(--text)] transition-colors flex items-center gap-2"><Youtube size={14} /> YouTube</a>
          </div>
        </div>
      </div>
      <p className="text-xs mt-16" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>
        © 2026 THUNDERSTREAM MEDIA
      </p>
    </footer>
  );
}
