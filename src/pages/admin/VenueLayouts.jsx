import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Grid3x3, Rows3, Upload } from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api';
import { T } from '../../shared';

// Parses either the CSV or JSON export of an auditorium seat map into a
// common { name, categories, seats } shape the /venues/import route
// understands. The JSON format is a superset of the CSV (it also carries
// the venue name and a category color legend); CSV rows derive the same
// category legend by de-duplicating the category/color_hex columns.
function parseSeatCSV(text, fallbackName) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());
  const col = (name) => headers.indexOf(name);
  const rowCol = col('row'), seatCol = col('seat_number'), catCol = col('category'),
    hexCol = col('color_hex'), xCol = col('x_px'), yCol = col('y_px');

  const catMap = new Map();
  const seats = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cols = line.split(',');
    const category = cols[catCol]?.trim() || null;
    const colorHex = cols[hexCol]?.trim();
    if (category && colorHex && !catMap.has(category)) catMap.set(category, colorHex);
    seats.push({
      row: cols[rowCol]?.trim(),
      seatNumber: Number(cols[seatCol]),
      category,
      x: Number(cols[xCol]),
      y: Number(cols[yCol]),
    });
  }
  return {
    name: fallbackName,
    categories: [...catMap.entries()].map(([name, colorHex]) => ({ name, colorHex })),
    seats,
  };
}

function parseSeatJSON(text, fallbackName) {
  const data = JSON.parse(text);
  const [venueName, city] = (data.venue || fallbackName).split(':').map((s) => s.trim());
  return {
    name: venueName,
    city: city || null,
    categories: (data.categories || []).map((c) => ({ name: c.name, colorHex: c.colorHex })),
    seats: (data.seats || []).map((s) => ({ row: s.row, seatNumber: s.seatNumber, category: s.category || null, x: s.x, y: s.y })),
  };
}

// A functional (not pixel-perfect) tool for building a venue's seat chart
// from the admin dashboard: create a venue, define zones (color + base
// price), then place seats on an SVG grid — click to drop one seat at a
// time, or lay out a whole row along a line by giving it a row label,
// starting seat number, and a start/end point. Drag-select an existing
// rectangle of seats to bulk-reassign their zone.
const GRID = 32;
const snap = (v) => Math.round(v / GRID) * GRID;

export default function VenueLayouts() {
  const [venues, setVenues] = useState([]);
  const [activeVenueId, setActiveVenueId] = useState(null);
  const [venueDetail, setVenueDetail] = useState(null); // { ...venue, zones, seats }
  const [error, setError] = useState('');

  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueCity, setNewVenueCity] = useState('');

  const [zoneForm, setZoneForm] = useState({ name: '', colorHex: '#F0362A', basePrice: '', sortOrder: 0 });
  const [activeZoneId, setActiveZoneId] = useState(null);

  const [rowForm, setRowForm] = useState({ rowLabel: 'A', startNumber: 1 });
  const [rowStart, setRowStart] = useState(null); // { x, y } in grid units, set on first click of "lay out row" mode
  const [layoutMode, setLayoutMode] = useState('click'); // 'click' | 'row'
  const [dragRect, setDragRect] = useState(null); // { x0, y0, x1, y1 } while drag-selecting
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [pendingSeats, setPendingSeats] = useState([]); // seats staged locally, not yet saved
  const [saving, setSaving] = useState(false);

  const [importBusy, setImportBusy] = useState(false);
  const fileInputRef = useRef(null);

  const loadVenues = () => apiGet('/api/admin/venues').then(setVenues).catch((err) => setError(err.message));
  useEffect(() => { loadVenues(); }, []);

  const loadVenueDetail = (id) => {
    apiGet(`/api/admin/venues/${id}`).then((v) => {
      setVenueDetail(v);
      setPendingSeats([]);
      setSelectedSeatIds([]);
      if (v.zones.length && !activeZoneId) setActiveZoneId(v.zones[0].id);
    }).catch((err) => setError(err.message));
  };

  useEffect(() => { if (activeVenueId) loadVenueDetail(activeVenueId); }, [activeVenueId]);

  const createVenue = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const v = await apiPost('/api/admin/venues', { name: newVenueName, city: newVenueCity || null });
      setNewVenueName(''); setNewVenueCity('');
      await loadVenues();
      setActiveVenueId(v.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteVenue = async (id) => {
    if (!window.confirm('Delete this venue and everything in it?')) return;
    try {
      await apiDelete(`/api/admin/venues/${id}`);
      if (activeVenueId === id) { setActiveVenueId(null); setVenueDetail(null); }
      loadVenues();
    } catch (err) {
      setError(err.message);
    }
  };

  const createZone = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await apiPost(`/api/admin/venues/${activeVenueId}/zones`, {
        name: zoneForm.name,
        colorHex: zoneForm.colorHex,
        basePrice: Number(zoneForm.basePrice) || 0,
        sortOrder: Number(zoneForm.sortOrder) || 0,
      });
      setZoneForm({ name: '', colorHex: '#F0362A', basePrice: '', sortOrder: 0 });
      loadVenueDetail(activeVenueId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportBusy(true);
    setError('');
    try {
      const text = await file.text();
      const isJSON = file.name.toLowerCase().endsWith('.json');
      const fallbackName = file.name.replace(/\.(csv|json)$/i, '');
      const parsed = isJSON ? parseSeatJSON(text, fallbackName) : parseSeatCSV(text, fallbackName);
      if (!parsed.seats.length) throw new Error('No seats found in that file.');
      const venue = await apiPost('/api/admin/venues/import', parsed);
      await loadVenues();
      setActiveVenueId(venue.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setImportBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteZone = async (zoneId) => {
    if (!window.confirm('Delete this zone? Seats in it will be deleted too.')) return;
    try {
      await apiDelete(`/api/admin/venues/zones/${zoneId}`);
      loadVenueDetail(activeVenueId);
    } catch (err) {
      setError(err.message);
    }
  };

  const allSeats = useMemo(() => [...(venueDetail?.seats || []), ...pendingSeats], [venueDetail, pendingSeats]);
  const zoneById = useMemo(() => new Map((venueDetail?.zones || []).map((z) => [z.id, z])), [venueDetail]);

  // Auto-fits the canvas viewBox to whatever seats actually exist (same
  // approach as the public seat map) instead of a fixed 1000x600 window —
  // a bulk-imported venue can span native pixel coordinates far larger
  // than a hand-placed one, and clamping those into a small fixed canvas
  // shrinks the gap between seats below their fixed circle radius.
  const canvasBox = useMemo(() => {
    if (!allSeats.length) return { x: 0, y: 0, w: 1000, h: 600 };
    const xs = allSeats.map((s) => s.posX);
    const ys = allSeats.map((s) => s.posY);
    const pad = 60;
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }, [allSeats]);

  // --- Canvas interaction ---
  const svgToGrid = (e, svg) => {
    const rect = svg.getBoundingClientRect();
    const x = canvasBox.x + ((e.clientX - rect.left) / rect.width) * canvasBox.w;
    const y = canvasBox.y + ((e.clientY - rect.top) / rect.height) * canvasBox.h;
    return { x: snap(x), y: snap(y) };
  };

  const nextSeatNumberFor = (rowLabel) => {
    const inRow = allSeats.filter((s) => s.rowLabel === rowLabel);
    return inRow.length ? Math.max(...inRow.map((s) => s.seatNumber)) + 1 : Number(rowForm.startNumber) || 1;
  };

  const stageSeat = (x, y, rowLabel, seatNumber) => {
    const tempId = `pending-${Date.now()}-${Math.random()}`;
    setPendingSeats((prev) => [...prev, {
      id: tempId, pending: true, zoneId: activeZoneId, rowLabel, seatNumber, posX: x, posY: y,
    }]);
  };

  const [dragging, setDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState(null);

  const handleCanvasMouseDown = (e) => {
    if (!activeZoneId && layoutMode !== 'select') return;
    const svg = e.currentTarget;
    const pt = svgToGrid(e, svg);
    if (layoutMode === 'select') {
      setDragOrigin(pt);
      setDragging(true);
      setDragRect({ x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y });
      return;
    }
    if (layoutMode === 'row') {
      if (!rowStart) {
        setRowStart(pt);
      } else {
        // Lay out seats evenly spaced along the line from rowStart to pt.
        const dx = pt.x - rowStart.x, dy = pt.y - rowStart.y;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.round(dist / GRID));
        let seatNumber = Number(rowForm.startNumber) || 1;
        for (let i = 0; i <= steps; i++) {
          const x = snap(rowStart.x + (dx * i) / steps);
          const y = snap(rowStart.y + (dy * i) / steps);
          stageSeat(x, y, rowForm.rowLabel, seatNumber);
          seatNumber += 1;
        }
        setRowStart(null);
      }
      return;
    }
    // 'click' mode: drop a single seat.
    stageSeat(pt.x, pt.y, rowForm.rowLabel, nextSeatNumberFor(rowForm.rowLabel));
  };

  const handleCanvasMouseMove = (e) => {
    if (!dragging || !dragOrigin) return;
    const svg = e.currentTarget;
    const pt = svgToGrid(e, svg);
    setDragRect({ x0: dragOrigin.x, y0: dragOrigin.y, x1: pt.x, y1: pt.y });
  };

  const handleCanvasMouseUp = () => {
    if (!dragging || !dragRect) { setDragging(false); return; }
    const xMin = Math.min(dragRect.x0, dragRect.x1), xMax = Math.max(dragRect.x0, dragRect.x1);
    const yMin = Math.min(dragRect.y0, dragRect.y1), yMax = Math.max(dragRect.y0, dragRect.y1);
    const inside = allSeats.filter((s) => s.posX >= xMin && s.posX <= xMax && s.posY >= yMin && s.posY <= yMax).map((s) => s.id);
    setSelectedSeatIds(inside);
    setDragging(false);
  };

  const reassignSelectedZone = () => {
    if (!activeZoneId || selectedSeatIds.length === 0) return;
    setPendingSeats((prev) => prev.map((s) => (selectedSeatIds.includes(s.id) ? { ...s, zoneId: activeZoneId } : s)));
    // Existing (already-saved) seats: stage a pending edit by moving them into pendingSeats-style patch list.
    setVenueDetail((prev) => {
      if (!prev) return prev;
      const stillSaved = prev.seats.map((s) => (selectedSeatIds.includes(s.id) ? { ...s, zoneId: activeZoneId, dirty: true } : s));
      return { ...prev, seats: stillSaved };
    });
  };

  const removeSeat = (seatId) => {
    setPendingSeats((prev) => prev.filter((s) => s.id !== seatId));
    setVenueDetail((prev) => (prev ? { ...prev, seats: prev.seats.filter((s) => s.id !== seatId) } : prev));
    setSelectedSeatIds((prev) => prev.filter((id) => id !== seatId));
  };

  const clearPending = () => setPendingSeats([]);

  const saveLayout = async () => {
    setSaving(true);
    setError('');
    try {
      // New seats: bulk-create.
      if (pendingSeats.length) {
        await apiPost(`/api/admin/venues/${activeVenueId}/seats/bulk`, {
          seats: pendingSeats.map((s) => ({ zoneId: s.zoneId, rowLabel: s.rowLabel, seatNumber: s.seatNumber, posX: s.posX, posY: s.posY })),
        });
      }
      // Existing seats whose zone was reassigned via drag-select.
      const dirty = (venueDetail?.seats || []).filter((s) => s.dirty);
      await Promise.all(dirty.map((s) => apiPatch(`/api/admin/venues/seats/${s.id}`, { zoneId: s.zoneId })));

      await loadVenueDetail(activeVenueId);
      await loadVenues();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSeatRemote = async (seatId) => {
    try {
      await apiDelete(`/api/admin/venues/seats/${seatId}`);
      loadVenueDetail(activeVenueId);
    } catch (err) {
      setError(err.message);
    }
  };

  const dirtyCount = (venueDetail?.seats || []).filter((s) => s.dirty).length;
  const unsavedCount = pendingSeats.length + dirtyCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-xs tracking-[.2em] uppercase mb-2" style={{ color: T.muted, fontFamily: "'JetBrains Mono', monospace" }}>Assigned seating</div>
          <h1 style={{ fontFamily: "'Fraunces', serif" }} className="text-3xl">Venue Layouts</h1>
        </div>
      </div>

      {error && <div className="mb-4 text-sm px-4 py-2.5 rounded-xl" style={{ background: 'rgba(240,54,42,.1)', color: T.ember }}>{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Venue list + create */}
        <div>
          <div className="rounded-2xl p-4 mb-4" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
            <p className="text-xs mb-3" style={{ color: T.muted }}>Venues</p>
            <div className="space-y-1 mb-4">
              {venues.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setActiveVenueId(v.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left"
                  style={{ background: activeVenueId === v.id ? 'rgba(240,54,42,.1)' : 'transparent', color: activeVenueId === v.id ? T.stream : T.text }}
                >
                  <span>{v.name}</span>
                  <span style={{ color: T.muted, fontSize: 11 }}>{v.seatCount}</span>
                </button>
              ))}
              {venues.length === 0 && <p className="text-xs" style={{ color: T.muted }}>No venues yet.</p>}
            </div>
            <form onSubmit={createVenue} className="space-y-2">
              <input required placeholder="New venue name" value={newVenueName} onChange={(e) => setNewVenueName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
              <input placeholder="City (optional)" value={newVenueCity} onChange={(e) => setNewVenueCity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
              <button type="submit" className="w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5" style={{ background: T.stream, color: T.bg }}>
                <Plus size={12} /> Create venue
              </button>
            </form>
            <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${T.line}` }}>
              <input ref={fileInputRef} type="file" accept=".csv,.json" onChange={handleImportFile} className="hidden" id="seat-import-input" />
              <label
                htmlFor="seat-import-input"
                className="w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text, opacity: importBusy ? 0.5 : 1, pointerEvents: importBusy ? 'none' : 'auto' }}
              >
                <Upload size={12} /> {importBusy ? 'Importing…' : 'Import seat map (CSV/JSON)'}
              </label>
              <p className="text-[10px] mt-1.5 leading-relaxed" style={{ color: T.muted }}>
                Creates a new venue with zones and seats from a seat-map export. Seats without a category land in an "Unassigned" zone you can reassign below.
              </p>
            </div>
          </div>

          {venueDetail && (
            <>
              <div className="rounded-2xl p-4 mb-4" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs" style={{ color: T.muted }}>Zones</p>
                  <button onClick={() => deleteVenue(venueDetail.id)} className="text-xs flex items-center gap-1" style={{ color: T.ember }}>
                    <Trash2 size={11} /> Delete venue
                  </button>
                </div>
                <div className="space-y-1 mb-3">
                  {venueDetail.zones.map((z) => (
                    <div key={z.id} className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveZoneId(z.id)}
                        className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left"
                        style={{ background: activeZoneId === z.id ? 'var(--wash)' : 'transparent', border: `1px solid ${activeZoneId === z.id ? z.colorHex : 'transparent'}` }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: z.colorHex, display: 'inline-block' }} />
                        <span style={{ color: T.text }}>{z.name}</span>
                        <span style={{ color: T.muted, marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace" }}>₹{z.basePrice}</span>
                      </button>
                      <button onClick={() => deleteZone(z.id)} style={{ color: T.muted }}><Trash2 size={12} /></button>
                    </div>
                  ))}
                  {venueDetail.zones.length === 0 && <p className="text-xs" style={{ color: T.muted }}>No zones yet — add one below.</p>}
                </div>
                <form onSubmit={createZone} className="space-y-2 pt-2" style={{ borderTop: `1px solid ${T.line}` }}>
                  <input required placeholder="Zone name" value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                  <div className="flex gap-2">
                    <input type="color" value={zoneForm.colorHex} onChange={(e) => setZoneForm({ ...zoneForm, colorHex: e.target.value })}
                      className="w-10 h-8 rounded-lg" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}` }} />
                    <input required type="number" placeholder="Base price" value={zoneForm.basePrice} onChange={(e) => setZoneForm({ ...zoneForm, basePrice: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-lg text-xs outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                    <input type="number" placeholder="Sort" value={zoneForm.sortOrder} onChange={(e) => setZoneForm({ ...zoneForm, sortOrder: e.target.value })}
                      className="w-16 px-2 py-2 rounded-lg text-xs outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                  </div>
                  <button type="submit" className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}>
                    + Add zone
                  </button>
                </form>
              </div>

              <div className="rounded-2xl p-4" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
                <p className="text-xs mb-3" style={{ color: T.muted }}>Seat tool</p>
                <div className="flex gap-1.5 mb-3">
                  <button
                    onClick={() => { setLayoutMode('click'); setRowStart(null); }}
                    className="flex-1 px-2 py-2 rounded-lg text-xs flex items-center justify-center gap-1"
                    style={{ background: layoutMode === 'click' ? T.stream : T.surfaceAlt, color: layoutMode === 'click' ? T.bg : T.text }}
                  >
                    <Plus size={12} /> Click seat
                  </button>
                  <button
                    onClick={() => { setLayoutMode('row'); setRowStart(null); }}
                    className="flex-1 px-2 py-2 rounded-lg text-xs flex items-center justify-center gap-1"
                    style={{ background: layoutMode === 'row' ? T.stream : T.surfaceAlt, color: layoutMode === 'row' ? T.bg : T.text }}
                  >
                    <Rows3 size={12} /> Lay out row
                  </button>
                  <button
                    onClick={() => { setLayoutMode('select'); setRowStart(null); }}
                    className="flex-1 px-2 py-2 rounded-lg text-xs flex items-center justify-center gap-1"
                    style={{ background: layoutMode === 'select' ? T.stream : T.surfaceAlt, color: layoutMode === 'select' ? T.bg : T.text }}
                  >
                    <Grid3x3 size={12} /> Select
                  </button>
                </div>

                {layoutMode !== 'select' && (
                  <div className="flex gap-2 mb-3">
                    <input placeholder="Row label" value={rowForm.rowLabel} onChange={(e) => setRowForm({ ...rowForm, rowLabel: e.target.value })}
                      className="w-20 px-2 py-2 rounded-lg text-xs outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                    <input type="number" placeholder="Start #" value={rowForm.startNumber} onChange={(e) => setRowForm({ ...rowForm, startNumber: e.target.value })}
                      className="flex-1 px-2 py-2 rounded-lg text-xs outline-none" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }} />
                  </div>
                )}

                <p className="text-[11px] leading-relaxed mb-3" style={{ color: T.muted }}>
                  {layoutMode === 'click' && 'Click the canvas to drop one seat at a time in the active zone.'}
                  {layoutMode === 'row' && (rowStart ? 'Click again to set the end of the row — seats will space out evenly along that line.' : 'Click to set the start of a row.')}
                  {layoutMode === 'select' && (selectedSeatIds.length
                    ? `${selectedSeatIds.length} seat(s) selected — pick the active zone above, then reassign.`
                    : 'Drag a rectangle over existing seats to select them.')}
                </p>

                {layoutMode === 'select' && selectedSeatIds.length > 0 && (
                  <button onClick={reassignSelectedZone} className="w-full px-3 py-2 rounded-lg text-xs font-medium" style={{ background: T.surfaceAlt, border: `1px solid ${T.line}`, color: T.text }}>
                    Reassign to active zone
                  </button>
                )}

                <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
                  <span className="text-xs" style={{ color: T.muted }}>{unsavedCount} unsaved change{unsavedCount === 1 ? '' : 's'}</span>
                  {pendingSeats.length > 0 && (
                    <button onClick={clearPending} className="text-xs" style={{ color: T.muted }}>Discard</button>
                  )}
                </div>
                <button
                  onClick={saveLayout}
                  disabled={saving || unsavedCount === 0}
                  className="w-full mt-2 px-3 py-2.5 rounded-lg text-xs font-medium disabled:opacity-40"
                  style={{ background: T.stream, color: T.bg }}
                >
                  {saving ? 'Saving…' : 'Save layout'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Canvas */}
        <div>
          {!venueDetail ? (
            <div className="rounded-2xl p-10 text-center text-sm" style={{ background: T.surface, border: `1px solid ${T.line}`, color: T.muted }}>
              Select or create a venue to start building its seat chart.
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: T.bg, border: `1px solid ${T.line}` }}>
              <svg
                viewBox={`${canvasBox.x} ${canvasBox.y} ${canvasBox.w} ${canvasBox.h}`}
                style={{ width: '100%', height: 'auto', maxHeight: 640, display: 'block', cursor: layoutMode === 'select' ? 'crosshair' : 'copy', background: T.bg }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
              >
                {/* grid */}
                {Array.from({ length: Math.ceil(canvasBox.w / GRID) + 1 }).map((_, i) => {
                  const gx = Math.floor(canvasBox.x / GRID) * GRID + i * GRID;
                  return <line key={`v${i}`} x1={gx} y1={canvasBox.y} x2={gx} y2={canvasBox.y + canvasBox.h} stroke={T.line} strokeWidth={0.5} />;
                })}
                {Array.from({ length: Math.ceil(canvasBox.h / GRID) + 1 }).map((_, i) => {
                  const gy = Math.floor(canvasBox.y / GRID) * GRID + i * GRID;
                  return <line key={`h${i}`} x1={canvasBox.x} y1={gy} x2={canvasBox.x + canvasBox.w} y2={gy} stroke={T.line} strokeWidth={0.5} />;
                })}

                {allSeats.map((s) => {
                  const zone = zoneById.get(s.zoneId);
                  const selected = selectedSeatIds.includes(s.id);
                  return (
                    <g key={s.id} onClick={(e) => { if (layoutMode !== 'select') { e.stopPropagation(); } }}>
                      <circle
                        cx={s.posX} cy={s.posY} r={9}
                        fill={zone?.colorHex || T.muted}
                        stroke={selected ? T.stream : 'rgba(0,0,0,.4)'}
                        strokeWidth={selected ? 2.5 : 1}
                        onDoubleClick={(e) => { e.stopPropagation(); if (s.pending) removeSeat(s.id); else if (window.confirm(`Delete seat ${s.rowLabel}${s.seatNumber}?`)) deleteSeatRemote(s.id); }}
                        style={{ cursor: 'pointer' }}
                      />
                      <text x={s.posX} y={s.posY + 3} textAnchor="middle" fontSize={7} fill={T.bg} style={{ pointerEvents: 'none' }}>{s.seatNumber}</text>
                      <text x={s.posX} y={s.posY - 12} textAnchor="middle" fontSize={8} fill={T.muted} style={{ pointerEvents: 'none' }}>{s.rowLabel}</text>
                    </g>
                  );
                })}

                {rowStart && (
                  <circle cx={rowStart.x} cy={rowStart.y} r={4} fill={T.stream} />
                )}

                {dragRect && (
                  <rect
                    x={Math.min(dragRect.x0, dragRect.x1)} y={Math.min(dragRect.y0, dragRect.y1)}
                    width={Math.abs(dragRect.x1 - dragRect.x0)} height={Math.abs(dragRect.y1 - dragRect.y0)}
                    fill="rgba(240,54,42,.12)" stroke={T.stream} strokeDasharray="4 3"
                  />
                )}
              </svg>
              <p className="text-[11px] px-4 py-2.5" style={{ color: T.muted, borderTop: `1px solid ${T.line}` }}>
                Double-click a seat to delete it. Coordinates snap to a {GRID}px grid.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
