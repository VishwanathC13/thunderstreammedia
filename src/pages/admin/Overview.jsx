import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { CalendarClock, CalendarDays, FileText, IndianRupee, Ticket, Users, Image, ArrowUpRight } from 'lucide-react';
import { apiGet } from '../../lib/api';
import { useAuth } from '../../lib/auth.jsx';
import { T } from '../../shared';
import StatTile from '../../components/admin/StatTile';

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const QUOTE_COLOR = { DRAFT: T.muted, SENT: T.daylight, VIEWED: '#E0568F', ACCEPTED: '#57C07A', CONVERTED: T.stream, EXPIRED: T.ember };

function Panel({ title, to, linkLabel, empty, children, isEmpty }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] tracking-[.18em] uppercase" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>{title}</h2>
        {to && <Link to={to} className="text-xs inline-flex items-center gap-1" style={{ color: T.muted }}>{linkLabel} <ArrowUpRight size={12} /></Link>}
      </div>
      {isEmpty ? <p className="text-sm py-4" style={{ color: T.muted }}>{empty}</p> : children}
    </div>
  );
}

function Row({ left, sub, right, rightColor }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5" style={{ borderTop: `1px solid ${T.line}` }}>
      <div className="min-w-0">
        <div className="text-sm truncate">{left}</div>
        {sub && <div className="text-xs truncate" style={{ color: T.muted }}>{sub}</div>}
      </div>
      <div className="text-xs shrink-0" style={{ color: rightColor || T.muted, fontFamily: "'JetBrains Mono', monospace" }}>{right}</div>
    </div>
  );
}

export default function Overview() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = () => apiGet('/api/admin/overview').then(setData).catch((err) => setError(err.message));
    load();
  }, []);

  const { bookings, clients, events, quotes, content } = data || {};

  const tiles = [
    bookings && { label: 'Pending bookings', value: bookings.pending, icon: CalendarClock },
    bookings && { label: 'Bookings this month', value: bookings.thisMonth, icon: CalendarDays },
    quotes && { label: 'Quotes awaiting reply', value: quotes.awaitingCount, icon: FileText },
    quotes && { label: 'Accepted quotes', value: inr(quotes.acceptedValue), icon: IndianRupee },
    events && { label: 'Ticket revenue', value: inr(events.ticketRevenue), icon: Ticket },
    clients && { label: 'Clients', value: clients.total, icon: Users },
    content && { label: 'Portfolio pieces live', value: content.published, icon: Image },
  ].filter(Boolean);

  const actions = [
    bookings && { to: '/admin/bookings', label: 'Block a date' },
    quotes && { to: '/admin/quotes', label: 'Build a quote' },
    events && { to: '/admin/events', label: 'Create an event' },
    content && { to: '/admin/content', label: 'Add portfolio work' },
  ].filter(Boolean);

  return (
    <div>
      <div className="mb-8">
        <div className="text-xs tracking-[.2em] uppercase mb-2" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Overview</div>
        <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl">Welcome back, {user.name.split(' ')[0]}.</h1>
      </div>

      {error && <div className="mb-6 text-sm px-4 py-2.5 rounded-xl" style={{ background: 'rgba(240,54,42,.1)', color: T.ember }}>{error}</div>}
      {!data && !error && <div className="text-sm" style={{ color: T.muted }}>Loading…</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {tiles.map((t) => <StatTile key={t.label} label={t.label} value={t.value} icon={t.icon} />)}
          </div>

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {actions.map((a) => (
                <Link key={a.to} to={a.to} className="text-sm px-4 py-2 rounded-full" style={{ border: `1px solid ${T.line}`, color: T.text }}>+ {a.label}</Link>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {bookings && (
              <Panel title="Upcoming bookings" to="/admin/bookings" linkLabel="Calendar" isEmpty={bookings.upcoming.length === 0} empty="Nothing booked yet. New website bookings will show up here.">
                {bookings.upcoming.map((b) => (
                  <Row
                    key={b.id}
                    left={[b.service?.label, b.client?.name].filter(Boolean).join(' — ') || 'Booking'}
                    sub={format(new Date(b.date), 'EEE, MMM d · h:mm a')}
                    right={b.status}
                    rightColor={b.status === 'CONFIRMED' ? T.stream : T.ember}
                  />
                ))}
              </Panel>
            )}

            {quotes && (
              <Panel title="Recent quotes" to="/admin/quotes" linkLabel="All quotes" isEmpty={quotes.recent.length === 0} empty="No quotes yet. Build one from the Quotes page or wait for a website request.">
                {quotes.recent.map((q) => (
                  <Row
                    key={q.id}
                    left={`#${q.id} · ${q.client || 'Unknown client'}`}
                    sub={`${inr(q.total)} · ${formatDistanceToNow(new Date(q.createdAt), { addSuffix: true })}`}
                    right={q.status}
                    rightColor={QUOTE_COLOR[q.status]}
                  />
                ))}
                {quotes.awaitingCount > 0 && (
                  <p className="text-xs pt-3" style={{ color: T.muted, borderTop: `1px solid ${T.line}` }}>
                    {quotes.awaitingCount} awaiting a reply, worth {inr(quotes.awaitingValue)}.
                  </p>
                )}
              </Panel>
            )}

            {events && (
              <Panel title="Upcoming ticketed events" to="/admin/events" linkLabel="Events" isEmpty={events.upcoming.length === 0} empty="No upcoming events on sale.">
                {events.upcoming.map((e) => (
                  <Row
                    key={e.id}
                    left={e.title}
                    sub={`${format(new Date(e.start), 'EEE, MMM d · h:mm a')} · ${e.venue || 'Online'}`}
                    right={`${e.ticketsSold} sold`}
                  />
                ))}
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  );
}
