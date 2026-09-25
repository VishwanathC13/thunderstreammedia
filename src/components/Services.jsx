import React, { useEffect, useState } from 'react';
import { Video, Camera, Radio, Play, ShoppingBag, Building2, Circle } from 'lucide-react';
import { T } from '../shared';
import { apiGet } from '../lib/api';

const ICONS = { video: Video, photo: Camera, live: Radio, post: Play, product: ShoppingBag, corporate: Building2 };

export default function Services() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    apiGet('/api/services', { auth: false }).then(setServices).catch((err) => console.error('failed to load services', err));
  }, []);

  return (
    <section id="services" className="px-5 md:px-10 py-24 md:py-32" style={{ borderTop: `1px solid ${T.line}` }}>
      <div className="reveal">
        <div className="inline-flex items-center gap-3 text-[11px] tracking-[0.22em] uppercase mb-5" style={{ fontFamily: "'JetBrains Mono', monospace", color: T.daylight }}>
          <span className="w-6 h-px" style={{ background: T.daylight }} />Services
        </div>
        <h2 style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-.02em" }} className="text-4xl md:text-6xl mb-16 max-w-3xl leading-[1.02]">
          Every format your production needs, under one crew.
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px reveal" style={{ background: T.line }}>
        {services.map((s) => {
          const Icon = ICONS[s.key] || Circle;
          return (
            <div key={s.key} className="relative p-9 group overflow-hidden" style={{ background: T.bg }}>
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(400px circle at 50% 0%, rgba(240,54,42,.10), transparent 70%)` }}
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-8">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                    style={{ background: "rgba(240,54,42,.10)", border: `1px solid rgba(240,54,42,.22)` }}>
                    <Icon size={19} style={{ color: T.stream }} />
                  </div>
                  <span className="text-[10px] tracking-[.16em]" style={{ fontFamily: "'JetBrains Mono', monospace", color: T.muted }}>
                    {s.spec}
                  </span>
                </div>
                <h3 className="text-2xl mb-2.5" style={{ fontFamily: "'Fraunces', serif" }}>{s.label}</h3>
                <p className="text-sm leading-relaxed" style={{ color: T.muted }}>{s.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
