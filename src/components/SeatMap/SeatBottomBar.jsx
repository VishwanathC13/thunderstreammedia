import React, { useEffect, useState } from 'react';
import { Ticket } from 'lucide-react';
import { T } from '../../shared';

// Sticky bottom bar for the seat-map flow: selecting -> held (with
// countdown) -> checking out. `stage` drives which controls show;
// `onHold`/`onCancelHold`/`onCheckout` are wired by EventDetail.jsx into
// the hold/tickets/tickets-confirm + Razorpay flow.
export default function SeatBottomBar({
  stage,          // 'selecting' | 'held' | 'processing'
  seatCount,
  total,
  expiresAt,      // ISO string, present while stage === 'held'
  onHold,
  onCancelHold,
  onCheckout,
  buyerName,
  buyerContact,
  onBuyerNameChange,
  onBuyerContactChange,
  error,
  busy,
}) {
  const [remainingMs, setRemainingMs] = useState(null);

  useEffect(() => {
    if (!expiresAt) { setRemainingMs(null); return undefined; }
    const target = new Date(expiresAt).getTime();
    const tick = () => setRemainingMs(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (seatCount === 0 && stage === 'selecting') return null;

  const mm = remainingMs != null ? String(Math.floor(remainingMs / 60000)).padStart(2, '0') : '--';
  const ss = remainingMs != null ? String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0') : '--';

  return (
    <div
      className="sticky bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-4 flex-wrap px-5 md:px-10 py-4"
      style={{ background: T.surface, borderTop: `1px solid ${T.line}` }}
    >
      <div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace" }} className="text-xl font-medium" >
          ₹{total.toLocaleString('en-IN')}
        </div>
        <div className="text-xs" style={{ color: T.muted }}>{seatCount} seat{seatCount === 1 ? '' : 's'}</div>
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-end">
        {error && <span className="text-xs" style={{ color: T.ember }}>{error}</span>}

        {stage === 'held' && (
          <>
            <div
              className="text-xs px-3 py-2 rounded-full font-medium"
              style={{ background: T.surfaceAlt, color: T.stream, border: `1px solid ${T.line}`, fontVariantNumeric: 'tabular-nums', fontFamily: "'JetBrains Mono', monospace" }}
            >
              Hold expires in {mm}:{ss}
            </div>
            <input
              required
              placeholder="Your name"
              value={buyerName}
              onChange={(e) => onBuyerNameChange(e.target.value)}
              className="text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text, minWidth: 140 }}
            />
            <input
              required
              placeholder="Email or WhatsApp"
              value={buyerContact}
              onChange={(e) => onBuyerContactChange(e.target.value)}
              className="text-sm px-4 py-2.5 rounded-xl outline-none"
              style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text, minWidth: 180 }}
            />
            <button
              onClick={onCancelHold}
              disabled={busy}
              className="px-4 py-2.5 rounded-full text-sm font-medium disabled:opacity-40"
              style={{ background: 'transparent', border: `1px solid ${T.line}`, color: T.muted }}
            >
              Cancel
            </button>
            <button
              onClick={onCheckout}
              disabled={busy || !buyerName || !buyerContact}
              className="px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 disabled:opacity-40"
              style={{ background: T.stream, color: T.bg }}
            >
              <Ticket size={15} /> {busy ? 'Processing…' : 'Checkout'}
            </button>
          </>
        )}

        {stage === 'selecting' && (
          <button
            onClick={onHold}
            disabled={busy || seatCount === 0}
            className="px-5 py-2.5 rounded-full text-sm font-medium flex items-center gap-2 disabled:opacity-40"
            style={{ background: T.stream, color: T.bg }}
          >
            <Ticket size={15} /> {busy ? 'Holding…' : 'Hold seats'}
          </button>
        )}
      </div>
    </div>
  );
}
