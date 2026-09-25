import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { MapPin, Ticket, ArrowLeft, Check, Radio, KeyRound } from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { getSeatMap, holdSeats, releaseHold } from '../lib/seatmapApi';
import { loadRazorpayCheckout } from '../lib/razorpay';
import { T, BRAND_HEX, FONT_IMPORT, Grain, Eyebrow } from '../shared';
import VideoPlayer from '../components/VideoPlayer';
import SeatMap from '../components/SeatMap/SeatMap';
import PartySizeModal from '../components/SeatMap/PartySizeModal';
import SeatBottomBar from '../components/SeatMap/SeatBottomBar';

export default function EventDetail() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [error, setError] = useState('');
  const [selectedTier, setSelectedTier] = useState(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [purchasing, setPurchasing] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [viaAccess, setViaAccess] = useState(false);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessTicketId, setAccessTicketId] = useState('');
  const [accessContact, setAccessContact] = useState('');
  const [accessBusy, setAccessBusy] = useState(false);
  const [accessError, setAccessError] = useState('');

  // --- Assigned-seating flow state ---
  const [seatData, setSeatData] = useState(null); // { zones, seats }
  const [seatError, setSeatError] = useState('');
  const [maxSeats, setMaxSeats] = useState(1);
  const [partyModalOpen, setPartyModalOpen] = useState(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [resetToken, setResetToken] = useState(0);
  const [hold, setHold] = useState(null); // { holdToken, expiresAt }
  const [seatBusy, setSeatBusy] = useState(false);
  const [seatTickets, setSeatTickets] = useState(null); // array of { ticketId, qrDataUrl, seatLabel }
  const [highlightZoneId, setHighlightZoneId] = useState(null);

  useEffect(() => {
    apiGet(`/api/events/${slug}`, { auth: false })
      .then(setEvent)
      .catch((err) => setError(err.message));
  }, [slug]);

  useEffect(() => {
    if (!event || !event.seatingMode) return;
    getSeatMap(slug)
      .then((data) => { setSeatData(data); setPartyModalOpen(true); })
      .catch((err) => setSeatError(err.message));
  }, [event, slug]);

  // Best-effort release if the buyer navigates away mid-hold (SPA
  // unmount) — the Redis TTL is the backstop for a hard tab close.
  useEffect(() => () => { if (hold) releaseHold(hold.holdToken).catch(() => {}); }, [hold]);

  const seatById = new Map((seatData?.seats || []).map((s) => [s.id, s]));
  const selectedSeatTotal = selectedSeatIds.reduce((sum, id) => sum + (seatById.get(id)?.price || 0), 0);
  const selectedSeatLabels = selectedSeatIds.map((id) => seatById.get(id)).filter(Boolean).map((s) => `${s.row}-${String(s.number).padStart(2, '0')}`);
  // Category price list for the sidebar — min seat price + availability per zone.
  const zoneStats = (seatData?.zones || []).map((z) => {
    const inZone = (seatData?.seats || []).filter((s) => s.zoneId === z.id);
    const available = inZone.filter((s) => s.status === 'AVAILABLE').length;
    const price = inZone.length ? Math.min(...inZone.map((s) => s.price)) : 0;
    return { ...z, price, total: inZone.length, available };
  });

  const handleHoldSeats = async () => {
    setSeatBusy(true);
    setSeatError('');
    try {
      const result = await holdSeats(slug, selectedSeatIds);
      setHold({ holdToken: result.holdToken, expiresAt: result.expiresAt });
    } catch (err) {
      setSeatError(err.message);
      // Refresh the map so seats someone else just took show as taken.
      getSeatMap(slug).then(setSeatData).catch(() => {});
      setSelectedSeatIds([]);
      setResetToken((t) => t + 1);
    } finally {
      setSeatBusy(false);
    }
  };

  const handleCancelHold = async () => {
    if (!hold) return;
    setSeatBusy(true);
    try {
      await releaseHold(hold.holdToken);
    } catch {
      // ignore — TTL will clean it up either way
    }
    setHold(null);
    setSelectedSeatIds([]);
    setResetToken((t) => t + 1);
    setSeatBusy(false);
    getSeatMap(slug).then(setSeatData).catch(() => {});
  };

  const handleSeatCheckout = async () => {
    if (!hold || !buyerName || !buyerContact) return;
    setSeatBusy(true);
    setSeatError('');
    try {
      const order = await apiPost(`/api/events/${slug}/tickets`, { holdToken: hold.holdToken, buyerName, buyerContact }, { auth: false });

      if (order.mocked) {
        const confirmed = await apiPost(`/api/events/${slug}/tickets/confirm`, {
          holdToken: hold.holdToken,
          buyerName,
          buyerContact,
          orderId: order.orderId,
        }, { auth: false });
        setSeatTickets(confirmed.tickets);
        setHold(null);
        setSeatBusy(false);
      } else {
        await loadRazorpayCheckout();
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: Math.round(order.amount * 100),
          currency: order.currency,
          name: 'Thunderstream Media',
          description: `${selectedSeatIds.length} seat(s) — ${event.title}`,
          order_id: order.orderId,
          prefill: { name: buyerName, contact: buyerContact.includes('@') ? undefined : buyerContact, email: buyerContact.includes('@') ? buyerContact : undefined },
          theme: { color: BRAND_HEX },
          handler: async (response) => {
            try {
              const confirmed = await apiPost(`/api/events/${slug}/tickets/confirm`, {
                holdToken: hold.holdToken,
                buyerName,
                buyerContact,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }, { auth: false });
              setSeatTickets(confirmed.tickets);
              setHold(null);
            } catch (err) {
              setSeatError(err.message);
            } finally {
              setSeatBusy(false);
            }
          },
          modal: { ondismiss: () => setSeatBusy(false) },
        });
        rzp.on('payment.failed', (resp) => {
          setSeatError(resp.error?.description || 'Payment failed');
          setSeatBusy(false);
        });
        rzp.open();
      }
    } catch (err) {
      setSeatError(err.message);
      setSeatBusy(false);
    }
  };

  const buyTicket = async (e) => {
    e.preventDefault();
    if (!selectedTier || !buyerName || !buyerContact) return;
    setPurchasing(true);
    setError('');
    try {
      const order = await apiPost(`/api/events/${slug}/tickets`, { tierId: selectedTier.id, buyerName, buyerContact }, { auth: false });

      if (order.mocked) {
        // Mock mode: a real Razorpay popup can't complete against a fake
        // order id, so skip straight to confirmation.
        const confirmed = await apiPost(`/api/events/${slug}/tickets/confirm`, {
          tierId: selectedTier.id,
          buyerName,
          buyerContact,
          orderId: order.orderId,
        }, { auth: false });
        setTicket(confirmed);
        setPurchasing(false);
      } else {
        await loadRazorpayCheckout();
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: Math.round(order.amount * 100), // Razorpay expects paise
          currency: order.currency,
          name: 'Thunderstream Media',
          description: `${selectedTier.name} — ${event.title}`,
          order_id: order.orderId,
          prefill: { name: buyerName, contact: buyerContact.includes('@') ? undefined : buyerContact, email: buyerContact.includes('@') ? buyerContact : undefined },
          theme: { color: BRAND_HEX },
          handler: async (response) => {
            try {
              const confirmed = await apiPost(`/api/events/${slug}/tickets/confirm`, {
                tierId: selectedTier.id,
                buyerName,
                buyerContact,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }, { auth: false });
              setTicket(confirmed);
            } catch (err) {
              setError(err.message);
            } finally {
              setPurchasing(false);
            }
          },
          modal: { ondismiss: () => setPurchasing(false) },
        });
        rzp.on('payment.failed', (resp) => {
          setError(resp.error?.description || 'Payment failed');
          setPurchasing(false);
        });
        rzp.open();
      }
    } catch (err) {
      setError(err.message);
      setPurchasing(false);
    }
  };

  const redeemAccess = async (e) => {
    e.preventDefault();
    if (!accessTicketId || !accessContact) return;
    setAccessBusy(true);
    setAccessError('');
    try {
      const found = await apiPost(`/api/events/${slug}/tickets/access`, { ticketId: accessTicketId, contact: accessContact }, { auth: false });
      setTicket(found);
      setViaAccess(true);
      setAccessOpen(false);
    } catch (err) {
      setAccessError(err.message);
    } finally {
      setAccessBusy(false);
    }
  };

  if (error && !event) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.muted }}>
        {error}
      </div>
    );
  }
  if (!event) {
    return <div className="min-h-screen" style={{ background: T.bg }} />;
  }

  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: "'Space Grotesk', sans-serif" }} className="min-h-screen w-full overflow-x-hidden">
      <style>{FONT_IMPORT}</style>
      <Grain />

      <div className="px-5 md:px-10 pt-8">
        <Link to="/#events" className="inline-flex items-center gap-2 text-sm" style={{ color: T.muted }}>
          <ArrowLeft size={14} /> Back to Thunderstream Media
        </Link>
      </div>

      <section className="px-5 md:px-10 py-16 md:py-24">
        <Eyebrow>Ticketed event</Eyebrow>
        <h1 style={{ fontFamily: "'Fraunces', serif", letterSpacing: '-.02em' }} className="text-4xl md:text-6xl mb-6 max-w-3xl leading-[1.02]">
          {event.title}
        </h1>
        <p className="text-sm flex items-center gap-2 mb-2" style={{ color: T.muted }}>
          <MapPin size={14} /> {event.venue || 'Online livestream'} &nbsp;•&nbsp; {format(new Date(event.start), 'PPP p')}
        </p>
        {event.description && <p className="max-w-xl mt-4" style={{ color: T.muted }}>{event.description}</p>}

        {event.geoBlocked ? (
          <div className="mt-10 max-w-md rounded-2xl p-6" style={{ background: T.surface, border: `1px solid ${T.line}`, color: T.muted }}>
            This event isn't available in your region.
          </div>
        ) : event.seatingMode ? (
          seatTickets ? (
            <div className="mt-10 max-w-2xl rounded-3xl p-8" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5 mx-auto" style={{ background: 'rgba(240,54,42,.14)', border: '1px solid rgba(240,54,42,.3)' }}>
                  <Check size={22} style={{ color: T.stream }} />
                </div>
                <p className="font-medium mb-1.5 text-lg">You're in.</p>
                <p className="text-sm" style={{ color: T.muted }}>{seatTickets.length} seat{seatTickets.length === 1 ? '' : 's'} confirmed — show these QR codes at check-in.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {seatTickets.map((t) => (
                  <div key={t.ticketId} className="rounded-2xl p-5 text-center" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}` }}>
                    <p className="text-sm mb-3" style={{ fontFamily: "'JetBrains Mono', monospace", color: T.text }}>
                      Seat {t.seatLabel} — #{t.ticketId}
                    </p>
                    <img src={t.qrDataUrl} alt={`QR code for seat ${t.seatLabel}`} className="mx-auto rounded-xl" style={{ width: 160 }} />
                  </div>
                ))}
              </div>
            </div>
          ) : seatError && !seatData ? (
            <div className="mt-10 max-w-md rounded-2xl p-6" style={{ background: T.surface, border: `1px solid ${T.line}`, color: T.ember }}>
              {seatError}
            </div>
          ) : !seatData ? (
            <div className="mt-10 max-w-md rounded-2xl p-6" style={{ background: T.surface, border: `1px solid ${T.line}`, color: T.muted }}>
              Loading seat map…
            </div>
          ) : (
            <div className="mt-10">
              <PartySizeModal
                open={partyModalOpen}
                maxSeats={maxSeats}
                onChangeMaxSeats={setMaxSeats}
                zones={zoneStats}
                onConfirm={() => setPartyModalOpen(false)}
              />
              <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                {/* Category price list + chosen-seats summary, BookMyShow-style */}
                <div className="rounded-2xl p-5" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
                  <p className="text-xs mb-3" style={{ color: T.muted }}>Select the category of your choice. It will get highlighted on the layout.</p>
                  <div className="space-y-1.5 mb-5">
                    {zoneStats.map((z) => {
                      const active = highlightZoneId === z.id;
                      return (
                        <button
                          key={z.id}
                          onClick={() => setHighlightZoneId((cur) => (cur === z.id ? null : z.id))}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                          style={{ background: active ? 'var(--wash)' : 'transparent', border: `1px solid ${active ? z.colorHex : T.line}` }}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: z.colorHex, flexShrink: 0 }} />
                          <span className="text-sm" style={{ fontFamily: "'JetBrains Mono', monospace", color: T.text }}>₹{z.price}</span>
                          <span className="text-xs ml-auto" style={{ color: T.muted }}>{z.available}/{z.total}</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedSeatIds.length > 0 && (
                    <div className="pt-4" style={{ borderTop: `1px solid ${T.line}` }}>
                      <p className="text-xs mb-2" style={{ color: T.muted }}>Chosen seats</p>
                      <p className="text-sm leading-relaxed" style={{ color: T.text }}>{selectedSeatLabels.join(' ')}</p>
                    </div>
                  )}
                </div>

                <div style={{ height: 560 }}>
                  <SeatMap
                    zones={seatData.zones}
                    seats={seatData.seats}
                    maxSeats={maxSeats}
                    locked={Boolean(hold) || Boolean(seatBusy)}
                    selectedIds={selectedSeatIds}
                    onSelectionChange={setSelectedSeatIds}
                    resetToken={resetToken}
                    highlightZoneId={highlightZoneId}
                    onHighlightChange={setHighlightZoneId}
                  />
                </div>
              </div>
            </div>
          )
        ) : null}

        {event.seatingMode && seatData && !seatTickets && (
          <SeatBottomBar
            stage={hold ? 'held' : 'selecting'}
            seatCount={selectedSeatIds.length}
            total={selectedSeatTotal}
            expiresAt={hold?.expiresAt}
            onHold={handleHoldSeats}
            onCancelHold={handleCancelHold}
            onCheckout={handleSeatCheckout}
            buyerName={buyerName}
            buyerContact={buyerContact}
            onBuyerNameChange={setBuyerName}
            onBuyerContactChange={setBuyerContact}
            error={seatError}
            busy={seatBusy}
          />
        )}

        {!event.seatingMode && (event.geoBlocked ? null : ticket ? (
          !viaAccess && (
            <div className="mt-10 max-w-md rounded-3xl p-8 text-center" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5 mx-auto" style={{ background: 'rgba(240,54,42,.14)', border: '1px solid rgba(240,54,42,.3)' }}>
                <Check size={22} style={{ color: T.stream }} />
              </div>
              <p className="font-medium mb-1.5 text-lg">You're in.</p>
              <p className="text-sm mb-6" style={{ color: T.muted }}>Ticket #{ticket.ticketId} — show this QR code at check-in.</p>
              <img src={ticket.qrDataUrl} alt="Ticket QR code" className="mx-auto rounded-xl" style={{ width: 220 }} />
            </div>
          )
        ) : (
          <div className="mt-10 max-w-md rounded-2xl p-6" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
            <div className="space-y-2 mb-6">
              {event.ticketTiers.map((tier) => {
                const soldOut = tier.quantitySold >= tier.quantityTotal;
                const active = selectedTier?.id === tier.id;
                return (
                  <button
                    key={tier.id}
                    disabled={soldOut}
                    onClick={() => setSelectedTier(tier)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-md text-left transition-all disabled:opacity-40"
                    style={{ border: `1px solid ${active ? T.stream : T.line}`, background: active ? 'rgba(240,54,42,.08)' : 'transparent' }}
                  >
                    <span>{tier.name} {soldOut && '(sold out)'}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: T.stream }}>₹{tier.price.toLocaleString('en-IN')}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={buyTicket} className="space-y-3">
              <input required placeholder="Your name" value={buyerName} onChange={(e) => setBuyerName(e.target.value)}
                className="w-full text-sm px-4 py-3 rounded-xl outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
              <input required placeholder="Email or WhatsApp number" value={buyerContact} onChange={(e) => setBuyerContact(e.target.value)}
                className="w-full text-sm px-4 py-3 rounded-xl outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
              {error && <p className="text-sm" style={{ color: T.ember }}>{error}</p>}
              <button
                type="submit"
                disabled={!selectedTier || purchasing}
                className="w-full py-3.5 rounded-full text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: T.stream, color: T.bg }}
              >
                <Ticket size={15} /> {purchasing ? 'Processing…' : 'Buy ticket'}
              </button>
            </form>

            <button
              onClick={() => setAccessOpen((o) => !o)}
              className="w-full mt-4 text-xs flex items-center justify-center gap-1.5"
              style={{ color: T.muted }}
            >
              <KeyRound size={12} /> Already have a ticket?
            </button>

            {accessOpen && (
              <form onSubmit={redeemAccess} className="mt-4 pt-4 space-y-3" style={{ borderTop: `1px solid ${T.line}` }}>
                <input required placeholder="Ticket ID" value={accessTicketId} onChange={(e) => setAccessTicketId(e.target.value)}
                  className="w-full text-sm px-4 py-3 rounded-xl outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                <input required placeholder="Email or WhatsApp number used to buy it" value={accessContact} onChange={(e) => setAccessContact(e.target.value)}
                  className="w-full text-sm px-4 py-3 rounded-xl outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                {accessError && <p className="text-sm" style={{ color: T.ember }}>{accessError}</p>}
                <button
                  type="submit"
                  disabled={accessBusy}
                  className="w-full py-3 rounded-full text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40"
                  style={{ background: 'transparent', border: `1px solid ${T.stream}`, color: T.stream }}
                >
                  <KeyRound size={14} /> {accessBusy ? 'Checking…' : 'Enter with ticket'}
                </button>
              </form>
            )}
          </div>
        ))}

        {event.livestreamUrl && ticket && !event.geoBlocked && (
          <div className="mt-10 max-w-5xl">
            <p className="text-sm mb-3 flex items-center gap-2" style={{ color: T.muted }}>
              <Radio size={16} style={{ color: T.stream }} /> Livestream
            </p>
            <VideoPlayer src={event.livestreamUrl} live inline title={event.title} />
          </div>
        )}
        {event.livestreamUrl && !ticket && (
          <div className="mt-10 max-w-5xl rounded-2xl p-6 flex items-center gap-3" style={{ background: T.surface, border: `1px solid ${T.line}`, color: T.muted }}>
            <Radio size={16} style={{ color: T.stream }} /> Livestream unlocks once you have a ticket.
          </div>
        )}
      </section>
    </div>
  );
}
