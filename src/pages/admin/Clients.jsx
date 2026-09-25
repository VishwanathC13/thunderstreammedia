import React, { useEffect, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api';
import { T } from '../../shared';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: '', contact: '', company: '', source: 'MANUAL' });
  const [error, setError] = useState('');

  const load = () => {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    apiGet(`/api/admin/clients${query}`).then(setClients).catch((err) => console.error(err));
  };

  useEffect(load, [q]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/api/admin/clients', form);
      setForm({ name: '', contact: '', company: '', source: 'MANUAL' });
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs tracking-[.2em] uppercase mb-2" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>CRM</div>
          <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl">Clients</h1>
        </div>
        <button
          onClick={() => setFormOpen((o) => !o)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium"
          style={{ background: T.stream, color: T.bg }}
        >
          <Plus size={14} /> Add client
        </button>
      </div>

      {formOpen && (
        <form onSubmit={submit} className="mb-6 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input required placeholder="Contact (phone/email)" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input placeholder="Company (optional)" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <button type="submit" className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: T.stream, color: T.bg }}>Save</button>
          {error && <div className="md:col-span-4 text-sm" style={{ color: T.ember }}>{error}</div>}
        </form>
      )}

      <div className="mb-5 relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: T.muted }} />
        <input
          placeholder="Search clients…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full pl-10 pr-3 py-2.5 rounded-full text-sm outline-none"
          style={{ background: T.surface, border: `1px solid ${T.line}`, color: T.text }}
        />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.line}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: T.surface, color: T.muted }}>
              <th className="text-left font-normal px-4 py-3">Name</th>
              <th className="text-left font-normal px-4 py-3">Contact</th>
              <th className="text-left font-normal px-4 py-3">Company</th>
              <th className="text-left font-normal px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} style={{ borderTop: `1px solid ${T.line}` }}>
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3" style={{ color: T.muted }}>{c.contact}</td>
                <td className="px-4 py-3" style={{ color: T.muted }}>{c.company || '—'}</td>
                <td className="px-4 py-3" style={{ color: T.muted }}>{c.source}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center" style={{ color: T.muted }}>No clients yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
