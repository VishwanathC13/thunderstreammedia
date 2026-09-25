import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, QrCode, Users, Radio, Check } from 'lucide-react';
import { apiGet, apiPost, apiPatch } from '../../lib/api';
import { T } from '../../shared';

const BLANK_FORM = { slug: '', title: '', description: '', start: '', end: '', venue: '', livestreamUrl: '', tierName: 'General', tierPrice: '', tierQty: '', seatingMode: false, seatingVenueId: '' };

export default function Events() {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [error, setError] = useState('');
  const [streamEdits, setStreamEdits] = useState({});
  const [streamSavingId, setStreamSavingId] = useState(null);

  const load = () => { apiGet('/api/admin/events').then(setEvents).catch((err) => console.error(err)); };
  useEffect(load, []);
  useEffect(() => { apiGet('/api/admin/venues').then(setVenues).catch((err) => console.error(err)); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        slug: form.slug,
        title: form.title,
        description: form.description || null,
        start: new Date(form.start).toISOString(),
        end: new Date(form.end).toISOString(),
        venue: form.venue || null,
        livestreamUrl: form.livestreamUrl || null,
        status: 'PUBLISHED',
        seatingMode: form.seatingMode,
        seatingVenueId: form.seatingMode && form.seatingVenueId ? Number(form.seatingVenueId) : null,
      };
      // Assigned-seating events don't need a price tier — pricing comes
      // from each seat's zone instead.
      if (!form.seatingMode) {
        payload.ticketTiers = [{ name: form.tierName, price: Number(form.tierPrice), quantityTotal: Number(form.tierQty) }];
      }
      await apiPost('/api/admin/events', payload);
      setForm(BLANK_FORM);
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveStreamUrl = async (id) => {
    setStreamSavingId(id);
    try {
      await apiPatch(`/api/admin/events/${id}`, { livestreamUrl: streamEdits[id] || null });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setStreamSavingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs tracking-[.2em] uppercase mb-2" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Ticketing</div>
          <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl">Events</h1>
        </div>
        <button onClick={() => setFormOpen((o) => !o)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium" style={{ background: T.stream, color: T.bg }}>
          <Plus size={14} /> New event
        </button>
      </div>

      {formOpen && (
        <form onSubmit={submit} className="mb-6 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-3" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <input required placeholder="Slug (url-friendly)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input placeholder="Venue (blank = online)" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input required type="datetime-local" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input required type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <input placeholder="Livestream URL (.m3u8, optional)" value={form.livestreamUrl} onChange={(e) => setForm({ ...form, livestreamUrl: e.target.value })}
            className="px-3 py-2.5 rounded-xl text-sm outline-none md:col-span-3" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />

          <label className="flex items-center gap-2 md:col-span-3 text-sm px-1" style={{ color: T.text }}>
            <input
              type="checkbox"
              checked={form.seatingMode}
              onChange={(e) => setForm({ ...form, seatingMode: e.target.checked })}
            />
            Assigned seating (uses a venue layout instead of price tiers)
          </label>

          {form.seatingMode ? (
            <select
              required
              value={form.seatingVenueId}
              onChange={(e) => setForm({ ...form, seatingVenueId: e.target.value })}
              className="px-3 py-2.5 rounded-xl text-sm outline-none md:col-span-3"
              style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}
            >
              <option value="">Select a venue…</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name} ({v.seatCount} seats)</option>
              ))}
            </select>
          ) : (
            <>
              <input required placeholder="Tier name" value={form.tierName} onChange={(e) => setForm({ ...form, tierName: e.target.value })}
                className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
              <input required type="number" placeholder="Price" value={form.tierPrice} onChange={(e) => setForm({ ...form, tierPrice: e.target.value })}
                className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
              <input required type="number" placeholder="Capacity" value={form.tierQty} onChange={(e) => setForm({ ...form, tierQty: e.target.value })}
                className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
            </>
          )}

          <button type="submit" className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: T.stream, color: T.bg }}>Publish event</button>
          {error && <div className="md:col-span-3 text-sm" style={{ color: T.ember }}>{error}</div>}
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map((ev) => {
          const sold = ev.tickets?.length || 0;
          const capacity = ev.ticketTiers?.reduce((sum, t) => sum + t.quantityTotal, 0) || 0;
          const editingValue = streamEdits[ev.id] ?? ev.livestreamUrl ?? '';
          return (
            <div key={ev.id} className="rounded-2xl p-5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-medium">{ev.title}</p>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'var(--wash)', color: T.muted }}>{ev.status}</span>
              </div>
              <p className="text-xs mb-4" style={{ color: T.muted }}>
                {ev.venue || 'Online'} · {sold}{ev.seatingMode ? '' : `/${capacity}`} tickets sold
                {ev.seatingMode && <span className="ml-2 px-2 py-0.5 rounded-full" style={{ background: 'rgba(111,168,214,.14)', color: T.daylight }}>Assigned seating</span>}
              </p>
              <div className="flex items-center gap-3 mb-4">
                <Link to={`/admin/events/${ev.id}/checkin`} className="text-xs px-3 py-2 rounded-full flex items-center gap-1.5" style={{ background: 'rgba(240,54,42,.12)', color: T.stream }}>
                  <QrCode size={13} /> Check-in scanner
                </Link>
                <Link to={`/events/${ev.slug}`} target="_blank" className="text-xs px-3 py-2 rounded-full flex items-center gap-1.5" style={{ color: T.muted }}>
                  <Users size={13} /> View public page
                </Link>
              </div>
              <div className="pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
                <p className="text-[10px] tracking-[.15em] uppercase mb-2 flex items-center gap-1.5" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>
                  <Radio size={11} /> Livestream URL
                </p>
                <div className="flex items-center gap-2">
                  <input
                    placeholder="https://.../stream.m3u8"
                    value={editingValue}
                    onChange={(e) => setStreamEdits((s) => ({ ...s, [ev.id]: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg text-xs outline-none"
                    style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}
                  />
                  <button
                    onClick={() => saveStreamUrl(ev.id)}
                    disabled={streamSavingId === ev.id}
                    className="text-xs px-3 py-2 rounded-lg flex items-center gap-1"
                    style={{ background: T.stream, color: T.bg }}
                  >
                    <Check size={12} /> {streamSavingId === ev.id ? 'Saving…' : 'Save'}
                  </button>
                </div>
                <p className="text-[10px] mt-1.5" style={{ color: T.muted }}>
                  {ev.livestreamUrl ? 'Live to ticket holders once you start broadcasting to this URL.' : 'Only ticket holders will see the player once a URL is set.'}
                </p>
              </div>
            </div>
          );
        })}
        {events.length === 0 && <p style={{ color: T.muted }}>No events yet.</p>}
      </div>
    </div>
  );
}
