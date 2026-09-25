import React from 'react';
import { T } from '../../shared';

export default function StatTile({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] tracking-[.18em] uppercase" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
        {Icon && <Icon size={14} style={{ color: T.stream }} />}
      </div>
      <div style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl">{value}</div>
    </div>
  );
}
