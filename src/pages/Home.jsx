import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Play, MapPin, Ticket, Radio } from 'lucide-react';
import { format } from 'date-fns';
import Navbar from '../components/Navbar';
import Marquee from '../components/Marquee';
import Stats from '../components/Stats';
import Services from '../components/Services';
import Work from '../components/Work';
import BookingCalendar from '../components/BookingCalendar';
import Footer from '../components/Footer';
import QuoteModal from '../components/QuoteModal';
import { apiGet, apiPost } from '../lib/api';
import { FONT_IMPORT, T, FILTERS, useReveal, Grain, Aperture, Eyebrow, SHOW_TICKETED_EVENTS } from '../shared';

export default function Home() {
  const [iris, setIris] = useState(false);
  const [filter, setFilter] = useState('all');
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [picked, setPicked] = useState([]);
  const [sent, setSent] = useState(false);
  const [quoteName, setQuoteName] = useState("");
  const [quoteContact, setQuoteContact] = useState("");
  const [solid, setSolid] = useState(false);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.4 });
  const [events, setEvents] = useState([]);
  const heroRef = useRef(null);

  useReveal();

  useEffect(() => {
    const t = setTimeout(() => setIris(true), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    apiGet('/api/events', { auth: false }).then(setEvents).catch((err) => console.error('failed to load events', err));
  }, []);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onMove = (e) => {
    const r = heroRef.current?.getBoundingClientRect();
    if (!r) return;
    setMouse({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };

  const toggle = (k) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const send = async () => {
    if (picked.length === 0) return;
    setSent(true);
    try {
      const data = await apiPost('/api/quotes', { name: quoteName, contact: quoteContact, services: picked }, { auth: false });
      console.log('quote response', data);
      setTimeout(() => { setQuoteOpen(false); setSent(false); setPicked([]); setQuoteName(''); setQuoteContact(''); }, 1400);
    } catch (err) {
      console.error(err);
      setSent(false);
      alert('Failed to send quote — see console');
    }
  };

  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: "'Space Grotesk', sans-serif" }} className="min-h-screen w-full overflow-x-hidden">
      <style>{FONT_IMPORT}</style>
      <Grain />

      <Navbar solid={solid} onRequestQuote={() => setQuoteOpen(true)} />

      {/* HERO */}
      <section
        ref={heroRef}
        onMouseMove={onMove}
        className="relative min-h-screen flex items-end overflow-hidden px-5 md:px-10 pb-20 pt-32"
      >
        {/* mouse-tracked key light */}
        <div
          className="absolute inset-0 z-0 transition-opacity duration-1000"
          style={{
            opacity: iris ? 1 : 0,
            background: `radial-gradient(720px circle at ${mouse.x * 100}% ${mouse.y * 100}%, rgba(240,54,42,.20), transparent 62%),
                         radial-gradient(900px circle at ${(1 - mouse.x) * 100}% 85%, rgba(111,168,214,.13), transparent 65%)`,
          }}
        />
        {/* horizon glow */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 z-0"
          style={{ background: `linear-gradient(to top, rgba(229,98,45,.10), transparent)` }} />

        <div className="absolute inset-0 z-30 pointer-events-none"><Aperture open={iris} /></div>

        <div className="relative z-10 w-full transition-all duration-1000" style={{ opacity: iris ? 1 : 0, transform: iris ? "none" : "translateY(20px)", transitionDelay: ".55s" }}>
          <Eyebrow>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.ember, animation: "pulseDot 1.6s ease-in-out infinite" }} />
            REC 00:00:00:00 — Bengaluru, on call everywhere
          </Eyebrow>
          <h1
            style={{ fontFamily: "'Fraunces', serif", lineHeight: .92, letterSpacing: "-.03em" }}
            className="text-[15vw] md:text-[10.5vw] lg:text-[9.5rem] font-medium mb-8"
          >
            We shoot it,
            <br />
            <span className="italic shine" style={{ fontWeight: 900 }}>stream&nbsp;it,</span>
            <br />
            deliver it.
          </h1>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <p className="text-base md:text-lg max-w-md" style={{ color: T.muted }}>
              Video, photo, live, post production, product, and full corporate coverage — one crew,
              one calendar, no dropped handoffs.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setQuoteOpen(true)}
                className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-medium transition-all hover:scale-105"
                style={{ background: T.stream, color: T.bg, boxShadow: "0 0 40px rgba(240,54,42,.4)" }}
              >
                Request a quotation
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#work"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-medium border transition-colors hover:border-[color:var(--muted)]"
                style={{ borderColor: T.line, background: "var(--wash)" }}
              >
                <Play size={15} fill={T.text} /> Watch the reel
              </a>
            </div>
          </div>
        </div>
      </section>

      <Marquee />

      <Stats />

      <Services />

      <section id="work" className="px-5 md:px-10 py-24 md:py-32" style={{ borderTop: `1px solid ${T.line}` }}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-7 mb-14 reveal">
          <div>
            <Eyebrow>Selected work</Eyebrow>
            <h2 style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-.02em" }} className="text-4xl md:text-6xl max-w-xl leading-[1.02]">
              Footage that speaks for the crew.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="text-xs px-4 py-2 rounded-full border transition-all"
                style={{
                  borderColor: filter === f.key ? T.stream : T.line,
                  color: filter === f.key ? T.bg : T.muted,
                  background: filter === f.key ? T.stream : "transparent",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <Work filter={filter} />
      </section>

      {/* BOOKING */}
      <section id="booking" className="px-5 md:px-10 py-24 md:py-32 relative" style={{ borderTop: `1px solid ${T.line}` }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(700px circle at 80% 40%, rgba(111,168,214,.07), transparent 65%)" }} />
        <div className="relative grid grid-cols-1 lg:grid-cols-9 gap-14">
          <div className="lg:col-span-2 reveal">
            <Eyebrow color={T.daylight}>Availability</Eyebrow>
            <h2 style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-.02em" }} className="text-4xl md:text-5xl mb-6 leading-[1.02]">
              One calendar.
              <br />
              <span style={{ color: T.daylight, fontStyle: "italic" }}>Every channel.</span>
            </h2>
            <p className="text-sm leading-relaxed mb-9 max-w-sm" style={{ color: T.muted }}>
              Pick a date, tell us which service you need, and we'll hold the slot while our
              team confirms — every channel feeds the same calendar, so what you see here is always
              real availability.
            </p>
            <div className="space-y-5">
              {[
                { n: '01', label: 'Pick a date' },
                { n: '02', label: 'Choose your service' },
                { n: '03', label: "We confirm — you're booked" },
              ].map((step) => (
                <div key={step.n} className="flex items-center gap-4 text-sm" style={{ color: T.muted }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: T.daylight }}>{step.n}</span>
                  {step.label}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 reveal">
            <BookingCalendar />
          </div>
        </div>
      </section>

      {/* EVENTS */}
      {SHOW_TICKETED_EVENTS && (
      <section id="events" className="px-5 md:px-10 py-24 md:py-32" style={{ borderTop: `1px solid ${T.line}` }}>
        <div className="reveal">
          <Eyebrow>Ticketed events</Eyebrow>
          <h2 style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-.02em" }} className="text-4xl md:text-6xl mb-14 max-w-2xl leading-[1.02]">
            Livestreamed, ticketed, geofenced where it matters.
          </h2>
        </div>
        <div className="reveal space-y-6">
          {events.length === 0 ? (
            <p style={{ color: T.muted }}>No events on sale right now — check back soon.</p>
          ) : events.map((ev) => {
              const cheapest = ev.ticketTiers?.length ? Math.min(...ev.ticketTiers.map((t) => t.price)) : null;
              return (
                <Link
                  key={ev.id}
                  to={`/events/${ev.slug}`}
                  className="rounded-3xl overflow-hidden flex flex-col md:flex-row"
                  style={{ background: T.surface, border: `1px solid ${T.line}`, boxShadow: 'var(--shadow-lg)' }}
                >
                  <div
                    className="media-dark md:w-2/5 aspect-video md:aspect-auto flex items-center justify-center relative overflow-hidden"
                    style={{ background: `linear-gradient(140deg, hsl(28 45% 24%), ${T.bg} 75%)` }}
                  >
                    <div className="absolute inset-0" style={{ background: "radial-gradient(300px circle at 50% 50%, rgba(240,54,42,.18), transparent 70%)" }} />
                    <Radio size={38} style={{ color: T.stream, animation: "floatSlow 5s ease-in-out infinite" }} />
                    <span
                      className="absolute top-5 left-5 text-[10px] px-3 py-1.5 rounded-full flex items-center gap-2"
                      style={{ background: "rgba(240,54,42,.14)", color: T.stream, fontFamily: "'JetBrains Mono', monospace", border: "1px solid rgba(240,54,42,.3)" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: T.ember, animation: "pulseDot 1.4s ease-in-out infinite" }} />
                      {format(new Date(ev.start), 'MMM d').toUpperCase()}
                    </span>
                  </div>
                  <div className="p-9 md:p-12 md:w-3/5 flex flex-col justify-center">
                    <h3 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl mb-3">{ev.title}</h3>
                    <p className="text-sm mb-8 flex items-center gap-2" style={{ color: T.muted }}>
                      <MapPin size={14} /> {ev.venue || 'Online livestream'} &nbsp;•&nbsp; {ev.description}
                    </p>
                    <div className="flex flex-wrap items-center gap-5">
                      {cheapest !== null && (
                        <span className="text-2xl" style={{ fontFamily: "'JetBrains Mono', monospace", color: T.stream }}>₹{cheapest.toLocaleString('en-IN')}</span>
                      )}
                      <span
                        className="group inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all hover:scale-105"
                        style={{ background: T.stream, color: T.bg, boxShadow: "0 0 32px rgba(240,54,42,.35)" }}
                      >
                        <Ticket size={15} /> Get tickets
                        <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
        </div>
      </section>
      )}

      {/* CTA */}
      <section className="px-5 md:px-10 py-28 text-center relative overflow-hidden reveal" style={{ borderTop: `1px solid ${T.line}` }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(600px circle at 50% 50%, rgba(240,54,42,.12), transparent 68%)" }} />
        <div className="relative">
          <h2 style={{ fontFamily: "'Fraunces', serif", letterSpacing: "-.03em" }} className="text-5xl md:text-8xl leading-[.95] mb-8">
            Let's roll
            <span style={{ color: T.stream }}>.</span>
          </h2>
          <button
            onClick={() => setQuoteOpen(true)}
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-full font-medium transition-all hover:scale-105"
            style={{ background: T.stream, color: T.bg, boxShadow: "0 0 50px rgba(240,54,42,.4)" }}
          >
            Request a quotation <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </section>

      <Footer />

      <QuoteModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        picked={picked}
        toggle={toggle}
        quoteName={quoteName}
        setQuoteName={setQuoteName}
        quoteContact={quoteContact}
        setQuoteContact={setQuoteContact}
        send={send}
        sent={sent}
      />
    </div>
  );
}
