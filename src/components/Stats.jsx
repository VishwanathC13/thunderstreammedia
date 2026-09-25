import React from 'react';
import { STATS, T } from '../shared';

export default function Stats() {
  return (
    <section className="px-5 md:px-10 py-20 grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6 reveal">
      {STATS.map((s, i) => (
        <div key={i}>
          <div style={{ fontFamily: "'Fraunces', serif", color: T.stream }} className="text-4xl md:text-6xl mb-1 leading-none">{s.n}</div>
          <div className="text-xs tracking-wide" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>{s.l}</div>
        </div>
      ))}
    </section>
  );
}
