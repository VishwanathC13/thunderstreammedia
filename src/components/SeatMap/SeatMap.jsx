import React, { useEffect, useMemo, useRef, useState } from 'react';
import { T } from '../../shared';
import { autoFillSeats, computeLayout, MIN_ZOOM, MAX_ZOOM } from './seatLogic';

// Zoomable/pannable SVG seat chart + minimap + zone legend, ported from
// seat-booking-system's public/index.html (initZoomPan/renderSeatMap/
// buildMinimap/toggleSeat/autoFillSeats). The pan/zoom math is kept
// unchanged and applied straight to the DOM via refs on the hot path
// (drag/wheel/pinch) so panning stays smooth; seat selection and legend
// highlighting go through React state since those only change on click.
//
// Props:
//   zones: [{ id, name, colorHex }]
//   seats: [{ id, row, number, x, y, zoneId, price, status }]  (status: AVAILABLE|HELD|BOOKED|BLOCKED)
//   maxSeats: number — party size from PartySizeModal
//   locked: boolean — true once a hold is active; disables further selection
//   selectedIds / onSelectionChange(ids) — controlled selection, lifted so
//     the bottom bar can show price/count and drive the hold/checkout flow
//   resetToken: bump to force-clear the current selection externally
//   highlightZoneId / onHighlightChange — controlled category highlight,
//     lifted so a sidebar category list (outside this component) can drive
//     the same dim/highlight the seat chart shows
export default function SeatMap({ zones, seats, maxSeats, locked, selectedIds, onSelectionChange, resetToken, highlightZoneId = null, onHighlightChange }) {
  const svgRef = useRef(null);
  const minimapRef = useRef(null);
  const minimapViewportRef = useRef(null);
  const vbRef = useRef(null);
  const baseVbRef = useRef(null);
  const centerAnimRef = useRef(null);
  const [infoMsg, setInfoMsg] = useState('');

  const zoneById = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const zoneColor = (zoneId) => zoneById.get(zoneId)?.colorHex || T.muted;

  const { baseViewBox, stage } = useMemo(() => computeLayout(seats), [seats]);

  const byRow = useMemo(() => {
    const map = new Map();
    for (const s of seats) {
      if (!map.has(s.row)) map.set(s.row, []);
      map.get(s.row).push(s);
    }
    return map;
  }, [seats]);

  const rowLabels = useMemo(() => {
    const out = [];
    for (const [row, rowSeats] of byRow) {
      const left = rowSeats.reduce((a, b) => (a.x < b.x ? a : b));
      out.push({ row, x: left.x - 16, y: left.y + 4 });
    }
    return out;
  }, [byRow]);

  // --- viewBox plumbing ---
  const applyViewBox = () => {
    const vb = vbRef.current;
    if (!vb || !svgRef.current) return;
    svgRef.current.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    if (minimapViewportRef.current) {
      minimapViewportRef.current.setAttribute('x', vb.x);
      minimapViewportRef.current.setAttribute('y', vb.y);
      minimapViewportRef.current.setAttribute('width', vb.w);
      minimapViewportRef.current.setAttribute('height', vb.h);
    }
  };

  useEffect(() => {
    baseVbRef.current = { ...baseViewBox };
    vbRef.current = { ...baseViewBox };
    applyViewBox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseViewBox]);

  const zoomBy = (factor, cx, cy) => {
    const vb = vbRef.current, base = baseVbRef.current;
    if (!vb || !base) return;
    const minW = base.w / MAX_ZOOM;
    const maxW = base.w / MIN_ZOOM;
    const newW = Math.min(maxW, Math.max(minW, vb.w / factor));
    const ratio = newW / vb.w;
    const newH = vb.h * ratio;
    vbRef.current = { x: cx - (cx - vb.x) * ratio, y: cy - (cy - vb.y) * ratio, w: newW, h: newH };
    applyViewBox();
  };

  const centerOn = (targetX, targetY, animate = true) => {
    const vb = vbRef.current;
    if (!vb || !baseVbRef.current) return;
    const destX = targetX - vb.w / 2;
    const destY = targetY - vb.h / 2;
    if (centerAnimRef.current) cancelAnimationFrame(centerAnimRef.current);
    if (!animate) {
      vbRef.current = { ...vb, x: destX, y: destY };
      applyViewBox();
      return;
    }
    const startX = vb.x, startY = vb.y;
    const duration = 350;
    const startTime = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const e = easeOutCubic(t);
      vbRef.current = { ...vbRef.current, x: startX + (destX - startX) * e, y: startY + (destY - startY) * e };
      applyViewBox();
      if (t < 1) centerAnimRef.current = requestAnimationFrame(step);
      else centerAnimRef.current = null;
    };
    centerAnimRef.current = requestAnimationFrame(step);
  };

  const centerIfNearEdge = (seat) => {
    const vb = vbRef.current;
    if (!vb) return;
    const marginX = vb.w * 0.22;
    const marginY = vb.h * 0.22;
    const nearEdge =
      seat.x < vb.x + marginX || seat.x > vb.x + vb.w - marginX ||
      seat.y < vb.y + marginY || seat.y > vb.y + vb.h - marginY;
    if (nearEdge) centerOn(seat.x, seat.y, true);
  };

  const svgPointFromClient = (clientX, clientY) => {
    const svg = svgRef.current;
    const vb = vbRef.current;
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return { x: vb.x + px * vb.w, y: vb.y + py * vb.h };
  };

  // --- mouse/touch pan + wheel/pinch zoom, attached once via refs ---
  useEffect(() => {
    const svg = svgRef.current;
    const minimap = minimapRef.current;
    if (!svg || !minimap) return undefined;

    const onWheel = (e) => {
      if (!vbRef.current) return;
      e.preventDefault();
      const pt = svgPointFromClient(e.clientX, e.clientY);
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, pt.x, pt.y);
    };

    let dragging = false;
    let dragMoved = false;
    let lastClientX = 0, lastClientY = 0;
    const onMouseDown = (e) => { dragging = true; dragMoved = false; lastClientX = e.clientX; lastClientY = e.clientY; };
    const onMouseMove = (e) => {
      if (!dragging || !vbRef.current) return;
      const rect = svg.getBoundingClientRect();
      const vb = vbRef.current;
      const dx = (e.clientX - lastClientX) * (vb.w / rect.width);
      const dy = (e.clientY - lastClientY) * (vb.h / rect.height);
      if (Math.abs(e.clientX - lastClientX) > 2 || Math.abs(e.clientY - lastClientY) > 2) dragMoved = true;
      vbRef.current = { ...vb, x: vb.x - dx, y: vb.y - dy };
      lastClientX = e.clientX; lastClientY = e.clientY;
      applyViewBox();
    };
    const onMouseUp = () => { dragging = false; };
    const onClickCapture = (e) => { if (dragMoved) { e.stopPropagation(); dragMoved = false; } };

    let minimapDragging = false;
    const jumpFromMinimap = (e) => {
      if (!baseVbRef.current) return;
      const rect = minimap.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      centerOn(baseVbRef.current.x + px * baseVbRef.current.w, baseVbRef.current.y + py * baseVbRef.current.h, false);
    };
    const onMinimapDown = (e) => { minimapDragging = true; jumpFromMinimap(e); };
    const onWindowMove = (e) => { if (minimapDragging) jumpFromMinimap(e); };
    const onWindowUp = () => { minimapDragging = false; };

    // Touch: one-finger drag to pan, two-finger pinch to zoom, double-tap to reset.
    let touchMode = null;
    let touchMoved = false;
    let panLastX = 0, panLastY = 0;
    let pinchStartDist = 0;
    let pinchStartVb = null;
    let pinchCenter = null;
    let lastTapTime = 0;
    const dist = (t1, t2) => Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    const midpoint = (t1, t2) => ({ clientX: (t1.clientX + t2.clientX) / 2, clientY: (t1.clientY + t2.clientY) / 2 });

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        touchMode = 'pan';
        touchMoved = false;
        panLastX = e.touches[0].clientX;
        panLastY = e.touches[0].clientY;
        const now = Date.now();
        if (now - lastTapTime < 300) {
          vbRef.current = { ...baseVbRef.current };
          applyViewBox();
          touchMode = null;
        }
        lastTapTime = now;
      } else if (e.touches.length === 2) {
        touchMode = 'pinch';
        touchMoved = true;
        pinchStartDist = dist(e.touches[0], e.touches[1]);
        pinchStartVb = { ...vbRef.current };
        const mid = midpoint(e.touches[0], e.touches[1]);
        pinchCenter = svgPointFromClient(mid.clientX, mid.clientY);
      }
    };
    const onTouchMove = (e) => {
      if (!vbRef.current) return;
      if (touchMode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        const rect = svg.getBoundingClientRect();
        const vb = vbRef.current;
        const dx = (t.clientX - panLastX) * (vb.w / rect.width);
        const dy = (t.clientY - panLastY) * (vb.h / rect.height);
        if (Math.abs(t.clientX - panLastX) > 2 || Math.abs(t.clientY - panLastY) > 2) touchMoved = true;
        vbRef.current = { ...vb, x: vb.x - dx, y: vb.y - dy };
        panLastX = t.clientX; panLastY = t.clientY;
        applyViewBox();
      } else if (touchMode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const d = dist(e.touches[0], e.touches[1]);
        const scale = d / pinchStartDist;
        const base = baseVbRef.current;
        const minW = base.w / MAX_ZOOM;
        const maxW = base.w / MIN_ZOOM;
        const newW = Math.min(maxW, Math.max(minW, pinchStartVb.w / scale));
        const ratio = newW / pinchStartVb.w;
        vbRef.current = {
          x: pinchCenter.x - (pinchCenter.x - pinchStartVb.x) * ratio,
          y: pinchCenter.y - (pinchCenter.y - pinchStartVb.y) * ratio,
          w: newW,
          h: pinchStartVb.h * ratio,
        };
        applyViewBox();
      }
    };
    const onTouchEnd = (e) => { if (e.touches.length === 0) touchMode = null; };
    const onTouchClickCapture = (e) => { if (touchMoved) { e.stopPropagation(); touchMoved = false; } };

    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    svg.addEventListener('click', onClickCapture, true);
    minimap.addEventListener('mousedown', onMinimapDown);
    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);
    svg.addEventListener('touchstart', onTouchStart, { passive: true });
    svg.addEventListener('touchmove', onTouchMove, { passive: false });
    svg.addEventListener('touchend', onTouchEnd);
    svg.addEventListener('click', onTouchClickCapture, true);

    return () => {
      svg.removeEventListener('wheel', onWheel);
      svg.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      svg.removeEventListener('click', onClickCapture, true);
      minimap.removeEventListener('mousedown', onMinimapDown);
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
      svg.removeEventListener('touchstart', onTouchStart);
      svg.removeEventListener('touchmove', onTouchMove);
      svg.removeEventListener('touchend', onTouchEnd);
      svg.removeEventListener('click', onTouchClickCapture, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear selection when asked to from outside (hold cancelled/expired, new load).
  useEffect(() => {
    if (resetToken !== undefined) onSelectionChange([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  const handleSeatClick = (seat) => {
    if (locked) return;
    const already = selectedIds.includes(seat.id);
    if (seat.status !== 'AVAILABLE' && !already) return;

    if (already) {
      onSelectionChange(selectedIds.filter((id) => id !== seat.id));
      return;
    }

    if (selectedIds.length === 0 && maxSeats > 1) {
      const picked = autoFillSeats(seat, maxSeats, seats);
      onSelectionChange(picked);
      setInfoMsg(picked.length < maxSeats
        ? `Only ${picked.length} seat${picked.length === 1 ? '' : 's'} available in total. Pick more manually if you'd like.`
        : '');
      centerIfNearEdge(seat);
      return;
    }

    let next = selectedIds;
    if (selectedIds.length >= maxSeats) next = next.slice(1);
    onSelectionChange([...next, seat.id]);
    centerIfNearEdge(seat);
  };

  const seatVisualStatus = (seat) => (selectedIds.includes(seat.id) ? 'SELECTED' : seat.status);

  const zoomIn = () => { const vb = vbRef.current; if (vb) zoomBy(1.4, vb.x + vb.w / 2, vb.y + vb.h / 2); };
  const zoomOut = () => { const vb = vbRef.current; if (vb) zoomBy(1 / 1.4, vb.x + vb.w / 2, vb.y + vb.h / 2); };

  const dimmed = highlightZoneId != null;

  return (
    <div className="ah-seatmap" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 480, background: T.bg, borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.line}` }}>
      <style>{SEATMAP_CSS}</style>

      <svg ref={svgRef} className={dimmed ? 'dimmed' : ''} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', touchAction: 'none' }}>
        <g>
          {rowLabels.map(({ row, x, y }) => (
            <text key={row} x={x} y={y} textAnchor="end" style={{ fontSize: 15, fontWeight: 700, fill: T.muted, userSelect: 'none' }}>{row}</text>
          ))}
        </g>
        <g>
          {seats.map((seat) => {
            const status = seatVisualStatus(seat);
            const zc = zoneColor(seat.zoneId);
            const hl = highlightZoneId == null || seat.zoneId === highlightZoneId;
            return (
              <g key={seat.id} className={hl ? 'hl' : ''}>
                <circle
                  className="seat"
                  data-status={status}
                  cx={seat.x}
                  cy={seat.y}
                  r={8.5}
                  style={{ '--zc': zc }}
                  onClick={() => handleSeatClick(seat)}
                >
                  <title>{`${zoneById.get(seat.zoneId)?.name || ''} ${seat.row}${seat.number} — ₹${seat.price}`}</title>
                </circle>
                {status !== 'BOOKED' && status !== 'BLOCKED' && (
                  <text x={seat.x} y={seat.y + 1.8} textAnchor="middle" style={{ fontSize: 8, fill: status === 'SELECTED' || status === 'HELD' ? T.bg : T.text, pointerEvents: 'none', userSelect: 'none' }}>
                    {seat.number}
                  </text>
                )}
              </g>
            );
          })}
        </g>
        <g>
          <rect x={stage.x} y={stage.y} width={stage.width} height={stage.height} rx={6} style={{ fill: T.surfaceAlt, stroke: T.line }} />
          <text x={stage.cx} y={stage.y + stage.height / 2 + 5} textAnchor="middle" style={{ fill: T.muted, fontSize: 16, letterSpacing: 3 }}>STAGE</text>
        </g>
      </svg>

      {/* Minimap */}
      <div ref={minimapRef} style={{ position: 'absolute', top: 16, right: 16, width: 200, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 10, padding: 6, boxShadow: '0 4px 18px rgba(0,0,0,.4)', cursor: 'pointer' }}>
        <svg viewBox={`${baseViewBox.x} ${baseViewBox.y} ${baseViewBox.w} ${baseViewBox.h}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {seats.map((seat) => (
            <circle key={seat.id} cx={seat.x} cy={seat.y} r={4} style={{ fill: zoneColor(seat.zoneId) }} />
          ))}
          <rect x={stage.x} y={stage.y} width={stage.width} height={stage.height} rx={6} style={{ fill: T.surfaceAlt }} />
          <rect ref={minimapViewportRef} style={{ fill: 'rgba(240,54,42,.14)', stroke: T.stream, strokeWidth: 5, pointerEvents: 'none' }} />
        </svg>
      </div>

      {/* Zoom controls */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={zoomIn} className="ah-zoom-btn" style={zoomBtnStyle}>+</button>
        <button onClick={zoomOut} className="ah-zoom-btn" style={zoomBtnStyle}>&minus;</button>
      </div>

      <div style={{ position: 'absolute', bottom: 16, left: 16, fontSize: 11, color: T.muted, background: 'color-mix(in srgb, var(--surface) 85%, transparent)', padding: '4px 9px', borderRadius: 14, border: `1px solid ${T.line}`, pointerEvents: 'none' }}>
        Pinch / scroll to zoom · drag to pan
      </div>

      {infoMsg && (
        <div style={{ position: 'absolute', top: 16, left: 16, fontSize: 12, color: T.text, background: T.surface, border: `1px solid ${T.line}`, padding: '8px 14px', borderRadius: 20, maxWidth: 280 }}>
          {infoMsg}
        </div>
      )}
    </div>
  );
}

const zoomBtnStyle = {
  width: 34, height: 34, borderRadius: '50%', border: `1px solid ${T.line}`,
  background: T.surface, color: T.text, fontSize: 17, lineHeight: 1, cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0,0,0,.35)',
};

const SEATMAP_CSS = `
.ah-seatmap circle.seat {
  fill: ${T.bg};
  stroke-width: 0.9px;
  cursor: pointer;
  transition: opacity .15s, stroke-width .1s, fill-opacity .1s, filter .1s;
}
.ah-seatmap circle.seat[data-status="AVAILABLE"] { stroke: var(--zc); }
.ah-seatmap circle.seat[data-status="AVAILABLE"]:hover { stroke-width: 2.4px; fill: var(--zc); fill-opacity: 0.22; filter: drop-shadow(0 0 3px var(--zc)); }
.ah-seatmap circle.seat[data-status="SELECTED"] { stroke: ${T.stream}; fill: ${T.stream}; }
.ah-seatmap circle.seat[data-status="HELD"] { stroke: ${T.ember}; fill: rgba(229,98,45,0.18); cursor: not-allowed; }
.ah-seatmap circle.seat[data-status="BOOKED"] { stroke: ${T.muted}; fill: ${T.muted}; cursor: not-allowed; opacity: .55; }
.ah-seatmap circle.seat[data-status="BLOCKED"] { stroke: ${T.line}; fill: ${T.line}; cursor: not-allowed; }
.ah-seatmap svg.dimmed g:not(.hl) circle.seat { opacity: 0.15; }
.ah-zoom-btn:hover { background: ${T.surfaceAlt}; }
@media (prefers-reduced-motion: reduce) {
  .ah-seatmap * { transition-duration: .001ms !important; }
}
`;
