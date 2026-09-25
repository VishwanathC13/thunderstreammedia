import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfDay, endOfMonth, endOfWeek,
  format, isSameDay, isSameMonth, isToday, startOfDay, startOfMonth, startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { T } from '../../shared';

// Google-Calendar-style Month / Week / Day view. Takes pre-normalized items:
//   { key, kind, title, start: Date, end: Date, allDay, color, dim, raw }
// and reports clicks through onSelect(item) — the parent owns the detail UI.
const HOUR_PX = 48;
const WEEK_OPTS = { weekStartsOn: 0 };
const VIEWS = [['month', 'Month'], ['week', 'Week'], ['day', 'Day']];
// item.color is a CSS variable reference, so tint with color-mix rather than hex alpha.
const tint = (color) => `color-mix(in srgb, ${color} 20%, transparent)`;

function itemsForDay(items, day) {
  const s = startOfDay(day).getTime();
  const e = endOfDay(day).getTime();
  // end is exclusive (Google all-day events end on the day *after* their last day).
  return items.filter((it) => it.start.getTime() <= e && it.end.getTime() > s);
}

// Greedy lane assignment so overlapping timed events sit side by side.
function layoutTimed(dayItems, day) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = endOfDay(day).getTime();
  const sorted = dayItems.filter((i) => !i.allDay).sort((a, b) => a.start - b.start);
  const lanes = [];
  const placed = sorted.map((it) => {
    const s = Math.max(it.start.getTime(), dayStart);
    const e = Math.min(it.end.getTime(), dayEnd);
    let lane = lanes.findIndex((end) => end <= s);
    if (lane === -1) { lane = lanes.length; lanes.push(e); } else lanes[lane] = e;
    return { it, s, e, lane };
  });
  return placed.map((p) => ({ ...p, lanes: lanes.length }));
}

function Chip({ item, onSelect }) {
  const filled = item.allDay;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onSelect(item); }}
      title={item.title}
      className="w-full flex items-center gap-1.5 px-1.5 py-[3px] rounded text-left text-[11px] leading-tight truncate"
      style={{
        background: filled ? tint(item.color) : 'transparent',
        color: T.text,
        opacity: item.dim ? 0.5 : 1,
        textDecoration: item.dim ? 'line-through' : 'none',
      }}
    >
      {!filled && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />}
      {filled && <span className="w-0.5 self-stretch rounded-full shrink-0" style={{ background: item.color }} />}
      {!filled && <span className="shrink-0" style={{ color: T.muted }}>{format(item.start, 'h:mma').toLowerCase()}</span>}
      <span className="truncate">{item.title}</span>
    </button>
  );
}

function MonthGrid({ items, cursor, onSelect, onPickDay }) {
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), WEEK_OPTS), end: endOfWeek(endOfMonth(cursor), WEEK_OPTS) });
  const MAX = 3;
  return (
    <div>
      <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${T.line}` }}>
        {days.slice(0, 7).map((d) => (
          <div key={d.getDay()} className="text-[11px] tracking-wide uppercase text-center py-2" style={{ color: T.muted }}>{format(d, 'EEE')}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayItems = itemsForDay(items, day).sort((a, b) => (b.allDay - a.allDay) || (a.start - b.start));
          const outside = !isSameMonth(day, cursor);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onPickDay(day)}
              className="min-h-[112px] p-1.5 cursor-pointer transition-colors hover:bg-[var(--wash)]"
              style={{ borderRight: (i + 1) % 7 ? `1px solid ${T.line}` : 'none', borderBottom: `1px solid ${T.line}`, opacity: outside ? 0.45 : 1 }}
            >
              <div className="flex justify-center mb-1">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ background: isToday(day) ? T.stream : 'transparent', color: isToday(day) ? T.bg : T.text, fontWeight: isToday(day) ? 700 : 400 }}
                >
                  {format(day, 'd')}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayItems.slice(0, MAX).map((it) => <Chip key={it.key} item={it} onSelect={onSelect} />)}
                {dayItems.length > MAX && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPickDay(day); }}
                    className="text-[11px] px-1.5 py-0.5"
                    style={{ color: T.muted }}
                  >
                    +{dayItems.length - MAX} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({ items, days, onSelect, onPickDay }) {
  const scrollRef = useRef(null);
  const [now, setNow] = useState(new Date());
  const cols = days.length;

  // Open scrolled to an hour before the earliest event in view (8 AM if none).
  useEffect(() => {
    if (!scrollRef.current) return;
    const hours = days.flatMap((d) => itemsForDay(items, d).filter((i) => !i.allDay))
      .map((i) => Math.max(i.start.getTime(), startOfDay(days[0]).getTime()))
      .map((t) => (t - startOfDay(new Date(t)).getTime()) / 3600000);
    const target = hours.length ? Math.max(0, Math.floor(Math.min(...hours)) - 1) : 7;
    scrollRef.current.scrollTop = target * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days[0].getTime(), cols]);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const allDayByDay = days.map((d) => itemsForDay(items, d).filter((i) => i.allDay));
  const maxAllDay = Math.max(0, ...allDayByDay.map((a) => a.length));
  const gridCols = { gridTemplateColumns: `56px repeat(${cols}, minmax(0, 1fr))` };

  return (
    <div>
      <div className="grid" style={{ ...gridCols, borderBottom: `1px solid ${T.line}` }}>
        <div />
        {days.map((d) => (
          <button key={d.toISOString()} onClick={() => onPickDay(d)} className="py-2 text-center" style={{ borderLeft: `1px solid ${T.line}` }}>
            <div className="text-[11px] tracking-wide uppercase" style={{ color: isToday(d) ? T.stream : T.muted }}>{format(d, 'EEE')}</div>
            <div
              className="mx-auto mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-lg"
              style={{ background: isToday(d) ? T.stream : 'transparent', color: isToday(d) ? T.bg : T.text, fontFamily: "'Fraunces', serif" }}
            >
              {format(d, 'd')}
            </div>
          </button>
        ))}
      </div>

      {maxAllDay > 0 && (
        <div className="grid" style={{ ...gridCols, borderBottom: `1px solid ${T.line}` }}>
          <div className="text-[10px] uppercase px-2 py-1.5 text-right" style={{ color: T.muted }}>All-day</div>
          {days.map((d, i) => (
            <div key={d.toISOString()} className="p-1 space-y-0.5" style={{ borderLeft: `1px solid ${T.line}` }}>
              {allDayByDay[i].map((it) => <Chip key={it.key} item={it} onSelect={onSelect} />)}
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: 620 }}>
        <div className="grid relative" style={{ ...gridCols, height: 24 * HOUR_PX }}>
          <div>
            {Array.from({ length: 24 }).map((_, h) => (
              <div key={h} className="text-[10px] text-right pr-2" style={{ height: HOUR_PX, color: T.muted, transform: 'translateY(-6px)' }}>
                {h === 0 ? '' : format(new Date(2000, 0, 1, h), 'h a')}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const placed = layoutTimed(itemsForDay(items, d), d);
            return (
              <div key={d.toISOString()} className="relative" style={{ borderLeft: `1px solid ${T.line}` }}>
                {Array.from({ length: 24 }).map((_, h) => (
                  <div key={h} style={{ height: HOUR_PX, borderTop: h === 0 ? 'none' : `1px solid ${T.line}` }} />
                ))}
                {placed.map(({ it, s, e, lane, lanes }) => {
                  const top = ((s - startOfDay(d).getTime()) / 3600000) * HOUR_PX;
                  const height = Math.max(22, ((e - s) / 3600000) * HOUR_PX - 2);
                  return (
                    <button
                      key={it.key}
                      onClick={() => onSelect(it)}
                      title={it.title}
                      className="absolute text-left rounded-md px-1.5 py-1 overflow-hidden text-[11px] leading-tight"
                      style={{
                        top, height,
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                        background: tint(it.color),
                        borderLeft: `3px solid ${it.color}`,
                        color: T.text,
                        opacity: it.dim ? 0.5 : 1,
                        textDecoration: it.dim ? 'line-through' : 'none',
                      }}
                    >
                      <div className="font-medium truncate">{it.title}</div>
                      <div style={{ color: T.muted }}>{format(it.start, 'h:mm')} – {format(it.end, 'h:mma').toLowerCase()}</div>
                    </button>
                  );
                })}
                {isToday(d) && (
                  <div className="absolute left-0 right-0 pointer-events-none" style={{ top: ((now - startOfDay(now)) / 3600000) * HOUR_PX }}>
                    <div className="h-px" style={{ background: T.stream }} />
                    <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full" style={{ background: T.stream }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CalendarView({ items, onSelect, onRangeChange }) {
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(new Date());

  const step = (dir) => {
    setCursor((c) => (view === 'month' ? addMonths(c, dir) : view === 'week' ? addWeeks(c, dir) : addDays(c, dir)));
  };

  const title = useMemo(() => {
    if (view === 'month') return format(cursor, 'MMMM yyyy');
    if (view === 'day') return format(cursor, 'EEEE, MMM d, yyyy');
    const s = startOfWeek(cursor, WEEK_OPTS);
    const e = endOfWeek(cursor, WEEK_OPTS);
    return isSameMonth(s, e) ? `${format(s, 'MMM d')} – ${format(e, 'd, yyyy')}` : `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
  }, [view, cursor]);

  // Tell the parent which window is on screen so it can fetch external events for it.
  const rangeFrom = view === 'month' ? startOfWeek(startOfMonth(cursor), WEEK_OPTS) : view === 'week' ? startOfWeek(cursor, WEEK_OPTS) : startOfDay(cursor);
  const rangeTo = view === 'month' ? endOfWeek(endOfMonth(cursor), WEEK_OPTS) : view === 'week' ? endOfWeek(cursor, WEEK_OPTS) : endOfDay(cursor);
  useEffect(() => {
    if (onRangeChange) onRangeChange(rangeFrom, rangeTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeFrom.getTime(), rangeTo.getTime()]);

  const pickDay = (day) => { setCursor(day); setView('day'); };
  const weekDays = eachDayOfInterval({ start: startOfWeek(cursor, WEEK_OPTS), end: endOfWeek(cursor, WEEK_OPTS) });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
      <div className="flex items-center gap-3 flex-wrap px-4 py-3" style={{ borderBottom: `1px solid ${T.line}` }}>
        <button
          onClick={() => setCursor(new Date())}
          className="px-3.5 py-1.5 rounded-full text-sm"
          style={{ border: `1px solid ${T.line}`, color: T.text }}
        >
          Today
        </button>
        <div className="flex items-center">
          <button onClick={() => step(-1)} aria-label="Previous" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--wash)]"><ChevronLeft size={18} /></button>
          <button onClick={() => step(1)} aria-label="Next" className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--wash)]"><ChevronRight size={18} /></button>
        </div>
        <h2 style={{ fontFamily: "'Fraunces', serif" }} className="text-xl">{title}</h2>
        <div className="ml-auto flex rounded-full p-0.5" style={{ border: `1px solid ${T.line}` }}>
          {VIEWS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className="px-3.5 py-1 rounded-full text-sm"
              style={{ background: view === key ? T.stream : 'transparent', color: view === key ? T.bg : T.muted }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'month' && <MonthGrid items={items} cursor={cursor} onSelect={onSelect} onPickDay={pickDay} />}
      {view === 'week' && <TimeGrid items={items} days={weekDays} onSelect={onSelect} onPickDay={pickDay} />}
      {view === 'day' && <TimeGrid items={items} days={[startOfDay(cursor)]} onSelect={onSelect} onPickDay={() => {}} />}
    </div>
  );
}
