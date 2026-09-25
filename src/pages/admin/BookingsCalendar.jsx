import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { X, CalendarPlus, Check } from 'lucide-react';
import { apiGet, apiPost, apiPatch } from '../../lib/api';
import { T, SRC_DOT } from '../../shared';
import CalendarView from '../../components/admin/CalendarView';

const BOOKING_DURATION_MS = 2 * 3600000;
const GOOGLE_GREEN = '#57C07A';

// Google returns all-day events as bare "YYYY-MM-DD" dates; new Date() would read
// those as UTC midnight, so build a local-midnight Date instead.
const parseGoogleDate = (value, allDay) => {
  if (!allDay) return new Date(value);
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export default function BookingsCalendar() {
  const [bookings, setBookings] = useState([]);
  const [events, setEvents] = useState([]);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [googleStatus, setGoogleStatus] = useState(null); // null = unknown, 'ok', 'off', or an error message
  const [selected, setSelected] = useState(null);
  const [clients, setClients] = useState([]);
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockDate, setBlockDate] = useState('');
  const [blockClientId, setBlockClientId] = useState('');
  const [blockNotes, setBlockNotes] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    apiGet('/api/admin/bookings').then(setBookings).catch((err) => console.error(err));
    apiGet('/api/admin/clients').then(setClients).catch((err) => console.error(err));
    apiGet('/api/admin/events').then(setEvents).catch((err) => console.error(err));
  };

  useEffect(load, []);

  const loadGoogleRange = useCallback((from, to) => {
    apiGet(`/api/admin/google-calendar/events?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
      .then((res) => {
        setGoogleEvents(res.events);
        setGoogleStatus(res.connected ? 'ok' : 'off');
      })
      .catch((err) => { setGoogleEvents([]); setGoogleStatus(err.message); });
  }, []);

  const submitBlock = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiPost('/api/admin/bookings/block', {
        date: new Date(blockDate).toISOString(),
        clientId: blockClientId ? Number(blockClientId) : null,
        notes: blockNotes || null,
      });
      setBlockOpen(false);
      setBlockDate('');
      setBlockClientId('');
      setBlockNotes('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const setStatus = async (id, status) => {
    await apiPatch(`/api/admin/bookings/${id}`, { status });
    load();
  };

  const [syncingId, setSyncingId] = useState(null);
  const syncToCalendar = async (id) => {
    setSyncingId(id);
    try {
      await apiPatch(`/api/admin/bookings/${id}/sync-calendar`, {});
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const items = useMemo(() => {
    const fromBookings = bookings.map((b) => {
      // Blocked days are stored as midnight UTC; rebuild from UTC parts so
      // the all-day chip lands on the intended calendar day in any timezone.
      const d = new Date(b.date);
      const start = b.isBlocked ? new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) : d;
      const label = [b.service?.label, b.client?.name].filter(Boolean).join(' — ');
      return {
        key: `b${b.id}`,
        kind: 'booking',
        title: b.isBlocked ? (b.client?.name ? `Blocked · ${b.client.name}` : 'Blocked') : label || 'Booking',
        start,
        end: new Date(start.getTime() + BOOKING_DURATION_MS),
        allDay: b.isBlocked,
        color: b.isBlocked ? T.muted : b.status === 'CONFIRMED' ? T.stream : b.status === 'PENDING' ? T.ember : T.muted,
        dim: b.status === 'CANCELLED',
        raw: b,
      };
    });
    const fromEvents = events.filter((e) => e.status !== 'CANCELLED').map((e) => ({
      key: `e${e.id}`, kind: 'event', title: e.title, start: new Date(e.start), end: new Date(e.end),
      allDay: false, color: T.daylight, dim: false, raw: e,
    }));
    const fromGoogle = googleEvents.map((g) => {
      const start = parseGoogleDate(g.start, g.allDay);
      return {
        key: `g${g.id}`, kind: 'google', title: g.title, start,
        end: g.allDay ? parseGoogleDate(g.end, true) : new Date(g.end),
        allDay: g.allDay, color: GOOGLE_GREEN, dim: false, raw: g,
      };
    });
    return [...fromBookings, ...fromEvents, ...fromGoogle];
  }, [bookings, events, googleEvents]);

  const sel = selected?.kind === 'booking' ? bookings.find((b) => b.id === selected.raw.id) : null;
  const selEvent = selected?.kind === 'event' ? selected.raw : null;
  const selGoogle = selected?.kind === 'google' ? selected.raw : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs tracking-[.2em] uppercase mb-2" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Calendar</div>
          <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl">Bookings</h1>
        </div>
        <button
          onClick={() => setBlockOpen((o) => !o)}
          className="px-4 py-2.5 rounded-full text-sm font-medium"
          style={{ background: T.stream, color: T.bg }}
        >
          Block a date
        </button>
      </div>

      {blockOpen && (
        <form onSubmit={submitBlock} className="mb-6 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3 items-start" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <input required type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <select value={blockClientId} onChange={(e) => setBlockClientId(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}>
            <option value="">No client (internal hold)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Notes (optional)" value={blockNotes} onChange={(e) => setBlockNotes(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
          <button type="submit" className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: T.stream, color: T.bg }}>Block</button>
          {error && <div className="md:col-span-4 text-sm" style={{ color: T.ember }}>{error}</div>}
        </form>
      )}

      <CalendarView items={items} onSelect={setSelected} onRangeChange={loadGoogleRange} />

      <div className="flex items-center gap-5 flex-wrap mt-3 mb-10 text-xs" style={{ color: T.muted }}>
        {[['Confirmed', T.stream], ['Pending', T.ember], ['Blocked / cancelled', T.muted], ['Ticketed event', T.daylight], ['Google Calendar', GOOGLE_GREEN]].map(([label, color]) => (
          <span key={label} className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: color }} />{label}</span>
        ))}
        {googleStatus === 'off' && <span>Google Calendar isn't connected — connect it in Settings to see its events here.</span>}
        {googleStatus && !['ok', 'off'].includes(googleStatus) && <span style={{ color: T.ember }}>Couldn't load Google Calendar: {googleStatus}</span>}
      </div>

      {(sel || selEvent || selGoogle) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: 'var(--scrim)' }} onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: T.surface, border: `1px solid ${T.line}`, boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3">
                <span className="w-3 h-3 rounded mt-1.5 shrink-0" style={{ background: selected.color }} />
                <div>
                  <h3 style={{ fontFamily: "'Fraunces', serif" }} className="text-xl leading-snug">{selected.title}</h3>
                  <p className="text-sm mt-1" style={{ color: T.muted }}>
                    {selected.allDay
                      ? format(selected.start, 'EEEE, MMM d, yyyy')
                      : `${format(selected.start, 'EEE, MMM d · h:mm a')} – ${format(selected.end, 'h:mm a')}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close" style={{ color: T.muted }}><X size={18} /></button>
            </div>

            {sel && (
              <div className="space-y-2 text-sm mb-5">
                {[
                  ['Status', sel.isBlocked ? 'Blocked' : sel.status],
                  ['Client', sel.client?.name || (sel.isBlocked ? 'Internal hold' : '—')],
                  ['Service', sel.service?.label || '—'],
                  ['Source', sel.source],
                  ['Notes', sel.notes || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3"><span className="w-16 shrink-0" style={{ color: T.muted }}>{k}</span><span>{v}</span></div>
                ))}
                {sel.meetingJoinUrl && (
                  <div className="flex gap-3"><span className="w-16 shrink-0" style={{ color: T.muted }}>Meeting</span>
                    <a href={sel.meetingJoinUrl} target="_blank" rel="noreferrer" style={{ color: T.daylight }}>Join link</a></div>
                )}
              </div>
            )}

            {selGoogle && (
              <div className="space-y-2 text-sm mb-5">
                <div className="flex gap-3"><span className="w-16 shrink-0" style={{ color: T.muted }}>Where</span><span>{selGoogle.location || '—'}</span></div>
                {selGoogle.description && <div className="flex gap-3"><span className="w-16 shrink-0" style={{ color: T.muted }}>Notes</span><span className="whitespace-pre-line">{selGoogle.description}</span></div>}
              </div>
            )}

            {selEvent && (
              <div className="space-y-2 text-sm mb-5">
                <div className="flex gap-3"><span className="w-16 shrink-0" style={{ color: T.muted }}>Venue</span><span>{selEvent.venue || 'Online'}</span></div>
                <div className="flex gap-3"><span className="w-16 shrink-0" style={{ color: T.muted }}>Status</span><span>{selEvent.status}</span></div>
                <div className="flex gap-3"><span className="w-16 shrink-0" style={{ color: T.muted }}>Tickets</span><span>{selEvent.tickets?.length ?? 0} sold</span></div>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {sel?.status === 'PENDING' && (
                <>
                  <button onClick={() => { setStatus(sel.id, 'CONFIRMED'); setSelected(null); }} className="text-sm px-4 py-2 rounded-full" style={{ background: T.stream, color: T.bg }}>Confirm</button>
                  <button onClick={() => { setStatus(sel.id, 'CANCELLED'); setSelected(null); }} className="text-sm px-4 py-2 rounded-full" style={{ background: 'rgba(229,98,45,.14)', color: T.ember }}>Cancel</button>
                </>
              )}
              {sel && !sel.isBlocked && sel.status !== 'CANCELLED' && !['synced', 'mocked-synced'].includes(sel.calendarSyncStatus) && (
                <button onClick={() => syncToCalendar(sel.id)} disabled={syncingId === sel.id} className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-full disabled:opacity-50" style={{ background: 'var(--wash)', color: T.text }}>
                  <CalendarPlus size={14} /> {syncingId === sel.id ? 'Syncing…' : 'Sync to Google Calendar'}
                </button>
              )}
              {sel && ['synced', 'mocked-synced'].includes(sel.calendarSyncStatus) && (
                <span className="inline-flex items-center gap-1 text-sm px-2 py-2" style={{ color: '#57C07A' }}><Check size={14} /> Synced to Google Calendar</span>
              )}
              {selGoogle && (
                <a href={selGoogle.htmlLink} target="_blank" rel="noreferrer" className="text-sm px-4 py-2 rounded-full" style={{ background: 'var(--wash)', color: T.text }}>Open in Google Calendar</a>
              )}
              {selEvent && (
                <Link to="/admin/events" className="text-sm px-4 py-2 rounded-full" style={{ background: 'var(--wash)', color: T.text }}>Manage in Events</Link>
              )}
            </div>
          </div>
        </div>
      )}

      <h2 className="text-xs tracking-[.2em] uppercase mb-3" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>All bookings</h2>
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${T.line}` }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: T.surface, color: T.muted }}>
              <th className="text-left font-normal px-4 py-3">Date</th>
              <th className="text-left font-normal px-4 py-3">Client</th>
              <th className="text-left font-normal px-4 py-3">Service</th>
              <th className="text-left font-normal px-4 py-3">Source</th>
              <th className="text-left font-normal px-4 py-3">Status</th>
              <th className="text-left font-normal px-4 py-3">Meeting</th>
              <th className="text-left font-normal px-4 py-3">Calendar</th>
              <th className="text-left font-normal px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} style={{ borderTop: `1px solid ${T.line}` }}>
                <td className="px-4 py-3">{format(new Date(b.date), 'MMM d, yyyy')}</td>
                <td className="px-4 py-3">{b.client?.name || (b.isBlocked ? 'Internal hold' : '—')}</td>
                <td className="px-4 py-3" style={{ color: T.muted }}>{b.service?.label || '—'}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5" style={{ color: T.muted }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: SRC_DOT[b.source?.toLowerCase()] || T.muted }} />
                    {b.source}
                  </span>
                </td>
                <td className="px-4 py-3" style={{ color: T.muted }}>{b.status}</td>
                <td className="px-4 py-3">
                  {b.meetingJoinUrl ? (
                    <a href={b.meetingJoinUrl} target="_blank" rel="noreferrer" style={{ color: T.daylight }}>Join link</a>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  {b.calendarSyncStatus === 'synced' || b.calendarSyncStatus === 'mocked-synced' ? (
                    <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#57C07A' }}>
                      <Check size={12} /> Synced
                    </span>
                  ) : (
                    <button
                      onClick={() => syncToCalendar(b.id)}
                      disabled={syncingId === b.id}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full disabled:opacity-50"
                      style={{ background: 'var(--wash)', color: T.muted }}
                    >
                      <CalendarPlus size={12} /> {syncingId === b.id ? 'Syncing…' : 'Sync'}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  {b.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button onClick={() => setStatus(b.id, 'CONFIRMED')} className="text-xs px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(240,54,42,.14)', color: T.stream }}>Confirm</button>
                      <button onClick={() => setStatus(b.id, 'CANCELLED')} className="text-xs px-2.5 py-1.5 rounded-full" style={{ background: 'rgba(229,98,45,.14)', color: T.ember }}>Cancel</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: T.muted }}>No bookings yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
