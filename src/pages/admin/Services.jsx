import React, { useEffect, useState } from 'react';
import { apiGet, apiPatch } from '../../lib/api';
import { T } from '../../shared';

export default function Services() {
  const [services, setServices] = useState([]);
  const [saving, setSaving] = useState(null);

  const load = () => { apiGet('/api/admin/services').then(setServices).catch((err) => console.error(err)); };
  useEffect(load, []);

  const updateField = (id, field, value) => {
    setServices((items) => items.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const save = async (service) => {
    setSaving(service.id);
    try {
      await apiPatch(`/api/admin/services/${service.id}`, {
        basePrice: Number(service.basePrice),
        unit: service.unit,
        active: service.active,
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs tracking-[.2em] uppercase mb-2" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Rate table</div>
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl">Services & pricing</h1>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.line}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: T.surface, color: T.muted }}>
              <th className="text-left font-normal px-4 py-3">Service</th>
              <th className="text-left font-normal px-4 py-3">Base price (₹)</th>
              <th className="text-left font-normal px-4 py-3">Unit</th>
              <th className="text-left font-normal px-4 py-3">Active</th>
              <th className="text-left font-normal px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} style={{ borderTop: `1px solid ${T.line}` }}>
                <td className="px-4 py-3">{s.label}</td>
                <td className="px-4 py-3">
                  <input type="number" value={s.basePrice} onChange={(e) => updateField(s.id, 'basePrice', e.target.value)}
                    className="w-28 px-2 py-1.5 rounded-lg text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                </td>
                <td className="px-4 py-3">
                  <input value={s.unit} onChange={(e) => updateField(s.id, 'unit', e.target.value)}
                    className="w-28 px-2 py-1.5 rounded-lg text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                </td>
                <td className="px-4 py-3">
                  <input type="checkbox" checked={s.active} onChange={(e) => updateField(s.id, 'active', e.target.checked)} />
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => save(s)} disabled={saving === s.id} className="text-xs px-3 py-1.5 rounded-full" style={{ background: T.stream, color: T.bg }}>
                    {saving === s.id ? 'Saving…' : 'Save'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
