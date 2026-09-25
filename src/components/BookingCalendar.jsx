import React, { useEffect, useRef, useState } from 'react';
import { startOfMonth, getDaysInMonth, getDay, addMonths, format, isBefore, startOfDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { T } from '../shared';

export default function BookingCalendar() {
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const [booked, setBooked] = useState({});
  const [services, setServices] = useState([]);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [panelIn, setPanelIn] = useState(false);

  const today = startOfDay(new Date());

  useEffect(() => {
    apiGet('/api/services', { auth: false }).then(setServices).catch((err) => console.error('failed to load services', err));
  }, []);

  const loadAvailability = () => {
    const monthParam = format(calMonth, 'yyyy-MM');
    apiGet(`/api/bookings/availability?month=${monthParam}`, { auth: false })
      .then((data) => {
        const map = {};
        for (const d of data.days) map[d.day] = d;
        setBooked(map);
      })
      .catch((err) => console.error('failed to load availability', err));
  };

  useEffect(() => {
    loadAvailability();
    setSelectedDay(null);
    setDone(false);
  }, [calMonth]);

  const daysInMonth = getDaysInMonth(calMonth);
  const offset = getDay(startOfMonth(calMonth));
  const monthLabel = format(calMonth, 'MMMM yyyy').toUpperCase();

  const selectDay = (day) => {
    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), day);
    if (booked[day]?.full || isBefore(date, today)) return;
    setSelectedDay(day);
    setDone(false);
    setError('');
  };

  const panelWasOpen = useRef(false);

  useEffect(() => {
    if (!selectedDay) {
      setPanelIn(false);
      panelWasOpen.current = false;
      return;
    }
    // Switching to a different date while the panel is already open should
    // just update in place, not replay the whole enter animation.
    if (panelWasOpen.current) {
      setPanelIn(true);
      return;
    }
    panelWasOpen.current = true;
    setPanelIn(false);
    // A single requestAnimationFrame can land in the same paint as the
    // initial (pre-transition) styles, so the "from" state never actually
    // renders and the transition silently no-ops. Nesting two rAFs
    // guarantees a real paint happens in between.
    let raf2;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPanelIn(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [selectedDay]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedDay || !selectedService || !name || !contact) return;
    setSubmitting(true);
    setError('');
    try {
      const iso = new Date(calMonth.getFullYear(), calMonth.getMonth(), selectedDay, 10, 0, 0).toISOString();
      await apiPost('/api/bookings', { name, contact, service: selectedService, date: iso, source: 'website' }, { auth: false });
      setDone(true);
      loadAvailability();
    } catch (err) {
      setError(err.message || 'Failed to submit booking request');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setSelectedDay(null);
    setSelectedService(null);
    setName('');
    setContact('');
    setDone(false);
    setError('');
  };

  const panelStyle = { background: T.surface, border: `1px solid ${T.line}`, boxShadow: 'var(--shadow-lg)' };

  return (
    <div className="flex flex-col md:flex-row gap-5 items-start justify-center">
      <div className="rounded-3xl p-6 md:p-7 w-full md:w-[27rem] md:shrink-0 max-w-lg mx-auto md:mx-0" style={panelStyle}>
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setCalMonth((m) => addMonths(m, -1))} className="p-2 rounded-full hover:bg-[var(--wash)] transition-colors" style={{ color: T.muted }}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-sm tracking-[.2em]">{monthLabel}</span>
          <button onClick={() => setCalMonth((m) => addMonths(m, 1))} className="p-2 rounded-full hover:bg-[var(--wash)] transition-colors" style={{ color: T.muted }}>
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 text-center mb-2.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <span key={i} className="text-[10px] tracking-widest" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-1">
          {Array.from({ length: offset }).map((_, i) => <div key={"p" + i} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), day);
            const info = booked[day];
            const isFull = Boolean(info?.full);
            const hasActivity = Boolean(info) && !isFull;
            const isPast = isBefore(date, today);
            const disabled = isFull || isPast;
            const active = selectedDay === day;
            return (
              <button
                key={day}
                disabled={disabled}
                title={isFull ? 'Unavailable' : hasActivity ? `${info.bookedCount} booking(s) already — still open` : undefined}
                onClick={() => selectDay(day)}
                className="aspect-square rounded-lg text-xs flex flex-col items-center justify-center gap-1 transition-all"
                style={{
                  background: active ? T.stream : disabled ? "transparent" : "var(--wash)",
                  border: `1px solid ${active ? T.stream : T.line}`,
                  color: active ? T.bg : isPast ? "rgba(140,137,146,.4)" : isFull ? T.muted : T.text,
                  cursor: disabled ? "default" : "pointer",
                  opacity: isPast && !isFull ? 0.35 : isFull ? 0.5 : 1,
                  textDecoration: isFull ? 'line-through' : 'none',
                }}
                onMouseEnter={(e) => { if (!disabled && !active) e.currentTarget.style.borderColor = T.stream; }}
                onMouseLeave={(e) => { if (!disabled && !active) e.currentTarget.style.borderColor = T.line; }}
              >
                {day}
                {hasActivity && <span className="w-1 h-1 rounded-full" style={{ background: active ? T.bg : T.daylight }} />}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div
          className="rounded-3xl p-6 md:p-7 w-full md:w-[27rem] md:shrink-0 max-w-lg mx-auto md:mx-0"
          style={{
            ...panelStyle,
            transformOrigin: 'left center',
            transition: 'opacity .7s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1)',
            willChange: 'opacity, transform',
            opacity: panelIn ? 1 : 0,
            transform: panelIn ? 'translateX(0) scale(1)' : 'translateX(-16px) scale(0.97)',
          }}
        >
          {!done ? (
            <form onSubmit={submit}>
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-medium">
                  {format(new Date(calMonth.getFullYear(), calMonth.getMonth(), selectedDay), 'EEEE, MMM d, yyyy')}
                </p>
                <button type="button" onClick={reset} style={{ color: T.muted }}><X size={15} /></button>
              </div>

              <p className="text-[11px] tracking-[0.15em] uppercase mb-2.5" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Service</p>
              <div className="flex flex-wrap gap-2 mb-5">
                {services.map((s) => {
                  const on = selectedService === s.key;
                  return (
                    <button
                      type="button"
                      key={s.key}
                      onClick={() => setSelectedService(s.key)}
                      className="text-xs px-3 py-2 rounded-full border flex items-center gap-1.5 transition-all"
                      style={{
                        borderColor: on ? T.stream : T.line,
                        background: on ? 'rgba(240,54,42,.10)' : 'transparent',
                        color: on ? T.stream : T.muted,
                      }}
                    >
                      {on && <Check size={11} />} {s.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 gap-3 mb-5">
                <input
                  required
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm px-4 py-3 rounded-xl outline-none"
                  style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}
                />
                <input
                  required
                  placeholder="Email or WhatsApp number"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="text-sm px-4 py-3 rounded-xl outline-none"
                  style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}
                />
              </div>

              {error && <p className="text-sm mb-4" style={{ color: T.ember }}>{error}</p>}

              <button
                type="submit"
                disabled={!selectedService || !name || !contact || submitting}
                className="w-full py-3.5 rounded-full text-sm font-medium transition-all disabled:opacity-35"
                style={{ background: T.stream, color: T.bg, boxShadow: !selectedService || !name || !contact ? 'none' : '0 0 30px rgba(240,54,42,.35)' }}
              >
                {submitting ? 'Sending…' : 'Request this date'}
              </button>
            </form>
          ) : (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto" style={{ background: 'rgba(240,54,42,.14)', border: '1px solid rgba(240,54,42,.3)' }}>
                <Check size={20} style={{ color: T.stream }} />
              </div>
              <p className="font-medium mb-1.5">Request sent</p>
              <p className="text-sm mb-5" style={{ color: T.muted }}>We've held this date — our team will confirm shortly.</p>
              <button onClick={reset} className="text-sm px-4 py-2 rounded-full border" style={{ borderColor: T.line, color: T.muted }}>Book another date</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
