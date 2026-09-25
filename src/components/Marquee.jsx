import React, { useEffect, useState } from 'react';
import { T } from '../shared';
import { apiGet } from '../lib/api';

export default function Marquee() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    apiGet('/api/services', { auth: false }).then(setServices).catch((err) => console.error('failed to load services', err));
  }, []);

  const marqueeItems = [...services, ...services];
  return (
    <div className="relative overflow-hidden py-5" style={{ borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
      <div className="flex gap-10 whitespace-nowrap" style={{ animation: 'marquee 34s linear infinite', width: 'max-content' }}>
        {marqueeItems.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-3 text-sm" style={{ color: i % 2 ? T.muted : T.text }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.stream }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
