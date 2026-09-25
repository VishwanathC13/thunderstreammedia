import React, { useEffect, useState } from 'react';
import { Plus, Send, Mail, MessageCircle, FileDown } from 'lucide-react';
import { apiGet, apiPost, apiPatch, BASE_URL } from '../../lib/api';
import { T } from '../../shared';

const STATUS_COLOR = {
  DRAFT: T.muted,
  SENT: T.daylight,
  VIEWED: '#E0568F',
  ACCEPTED: '#57C07A',
  CONVERTED: T.stream,
  EXPIRED: T.ember,
};

export default function Quotes() {
  const [quotes, setQuotes] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [lineItems, setLineItems] = useState([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = () => apiGet('/api/admin/quotes').then(setQuotes).catch((err) => console.error(err));

  useEffect(() => {
    load();
    apiGet('/api/admin/clients').then(setClients).catch((err) => console.error(err));
    // Admin endpoint (not the public /api/services) so inactive quote-only
    // rate-card entries — e.g. duration-tiered pricing not shown on the
    // public site — are still selectable when building a quote.
    apiGet('/api/admin/services').then(setServices).catch((err) => console.error(err));
  }, []);

  const addLineItem = (service) => {
    setLineItems((items) => [...items, { serviceId: service.id, label: service.label, qty: 1, unitPrice: service.basePrice }]);
  };

  const updateLineItem = (idx, field, value) => {
    setLineItems((items) => items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const removeLineItem = (idx) => setLineItems((items) => items.filter((_, i) => i !== idx));

  const total = lineItems.reduce((sum, i) => sum + Number(i.qty || 0) * Number(i.unitPrice || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/api/admin/quotes', {
        clientId: Number(clientId),
        lineItems: lineItems.map((i) => ({ ...i, qty: Number(i.qty), unitPrice: Number(i.unitPrice) })),
        note: note || null,
      });
      setFormOpen(false);
      setClientId('');
      setLineItems([]);
      setNote('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const send = async (id, channel) => {
    await apiPost(`/api/admin/quotes/${id}/send`, { channel });
    load();
  };

  const setStatus = async (id, status) => {
    await apiPatch(`/api/admin/quotes/${id}/status`, { status });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs tracking-[.2em] uppercase mb-2" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Quotation engine</div>
          <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl">Quotes</h1>
        </div>
        <button onClick={() => setFormOpen((o) => !o)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium" style={{ background: T.stream, color: T.bg }}>
          <Plus size={14} /> Build a quote
        </button>
      </div>

      {formOpen && (
        <form onSubmit={submit} className="mb-6 rounded-2xl p-5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <select required value={clientId} onChange={(e) => setClientId(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}>
              <option value="">Select client…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            {services.map((s) => (
              <button type="button" key={s.key} onClick={() => addLineItem(s)}
                className="text-xs px-3 py-2 rounded-full border" style={{ borderColor: T.line, color: T.muted }}>
                + {s.label}
              </button>
            ))}
          </div>

          {lineItems.length > 0 && (
            <div className="space-y-2 mb-4">
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input value={item.label} onChange={(e) => updateLineItem(idx, 'label', e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                  <input type="number" min="0.5" step="0.5" value={item.qty} onChange={(e) => updateLineItem(idx, 'qty', e.target.value)}
                    className="w-20 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                  <input type="number" min="0" value={item.unitPrice} onChange={(e) => updateLineItem(idx, 'unitPrice', e.target.value)}
                    className="w-28 px-3 py-2 rounded-lg text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                  <button type="button" onClick={() => removeLineItem(idx)} className="text-xs px-2" style={{ color: T.ember }}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div style={{ fontFamily: "'JetBrains Mono', monospace", color: T.stream }} className="text-lg">Total: ₹{total.toLocaleString('en-IN')}</div>
            <button type="submit" disabled={lineItems.length === 0} className="px-5 py-2.5 rounded-full text-sm font-medium disabled:opacity-40" style={{ background: T.stream, color: T.bg }}>Save quote</button>
          </div>
          {error && <div className="mt-3 text-sm" style={{ color: T.ember }}>{error}</div>}
        </form>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.line}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: T.surface, color: T.muted }}>
              <th className="text-left font-normal px-4 py-3">#</th>
              <th className="text-left font-normal px-4 py-3">Client</th>
              <th className="text-left font-normal px-4 py-3">Total</th>
              <th className="text-left font-normal px-4 py-3">Status</th>
              <th className="text-left font-normal px-4 py-3">Sent via</th>
              <th className="text-left font-normal px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} style={{ borderTop: `1px solid ${T.line}` }}>
                <td className="px-4 py-3">{q.id}</td>
                <td className="px-4 py-3">{q.client?.name}</td>
                <td className="px-4 py-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>₹{q.total.toLocaleString('en-IN')}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 rounded-full" style={{ color: STATUS_COLOR[q.status], background: 'var(--wash)' }}>{q.status}</span>
                </td>
                <td className="px-4 py-3" style={{ color: T.muted }}>{q.sentVia || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <a href={`${BASE_URL}/api/quotes/${q.id}/pdf`} target="_blank" rel="noreferrer" title="Download PDF" style={{ color: T.muted }}><FileDown size={15} /></a>
                    <button onClick={() => send(q.id, 'EMAIL')} title="Send via email" style={{ color: T.muted }}><Mail size={15} /></button>
                    <button onClick={() => send(q.id, 'WHATSAPP')} title="Send via WhatsApp" style={{ color: T.muted }}><MessageCircle size={15} /></button>
                    {q.status === 'SENT' && (
                      <button onClick={() => setStatus(q.id, 'ACCEPTED')} className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(87,192,122,.14)', color: '#57C07A' }}>Mark accepted</button>
                    )}
                    {q.status === 'ACCEPTED' && (
                      <button onClick={() => setStatus(q.id, 'CONVERTED')} className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(240,54,42,.14)', color: T.stream }}>Mark converted</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: T.muted }}>No quotes yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
