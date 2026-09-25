// Pure seat-selection math ported near-verbatim from the seat-booking-system
// demo's autoFillSeats/rowDistance (public/index.html) — kept as plain
// functions (no DOM) so SeatMap.jsx can drive them from React state.

// Finds up to `count` available seats, starting with the best contiguous
// run in `seat`'s own row (expanding outward by on-screen x position), then
// spilling into whichever other rows are physically closest (by on-screen y)
// until `count` is reached or availability runs out entirely.
export function autoFillSeats(seat, count, allSeats) {
  const usedIds = new Set();

  function takeFromRow(rowLabel, anchorX, need) {
    const rowSeats = allSeats
      .filter((s) => s.row === rowLabel && !usedIds.has(s.id) && (s.status === 'AVAILABLE' || s.id === seat.id))
      .sort((a, b) => a.x - b.x);
    if (rowSeats.length === 0) return [];
    let idx = 0;
    let bestDist = Infinity;
    rowSeats.forEach((s, i) => {
      const d = Math.abs(s.x - anchorX);
      if (d < bestDist) { bestDist = d; idx = i; }
    });
    let left = idx, right = idx;
    const picked = [rowSeats[idx]];
    while (picked.length < need) {
      const canRight = right + 1 < rowSeats.length;
      const canLeft = left - 1 >= 0;
      if (!canRight && !canLeft) break;
      if (canRight) { right++; picked.push(rowSeats[right]); if (picked.length >= need) break; }
      if (canLeft) { left--; picked.push(rowSeats[left]); }
    }
    return picked;
  }

  let picked = takeFromRow(seat.row, seat.x, count);
  picked.forEach((s) => usedIds.add(s.id));

  if (picked.length < count) {
    const rowsByDistance = [...new Set(
      allSeats.filter((s) => s.status === 'AVAILABLE' && !usedIds.has(s.id)).map((s) => s.row)
    )].sort((a, b) => rowDistance(a, seat.row, allSeats) - rowDistance(b, seat.row, allSeats));

    for (const row of rowsByDistance) {
      if (picked.length >= count) break;
      const more = takeFromRow(row, seat.x, count - picked.length);
      more.forEach((s) => usedIds.add(s.id));
      picked = picked.concat(more);
    }
  }

  return picked.map((s) => s.id);
}

function rowDistance(rowLabel, fromRow, allSeats) {
  const ys = allSeats.filter((s) => s.row === rowLabel).map((s) => s.y);
  const fromYs = allSeats.filter((s) => s.row === fromRow).map((s) => s.y);
  const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.abs(avg(ys) - avg(fromYs));
}

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 6;

// Computes the full-extent viewBox for a seat layout, plus a stage rect
// below the seats — same layout math as the demo's renderSeatMap.
export function computeLayout(seats) {
  const xs = seats.map((s) => s.x);
  const ys = seats.map((s) => s.y);
  const pad = 40;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const stageY = Math.max(...ys) + 45;
  const stageH = 70;
  const maxY = stageY + stageH + 20;
  const stageW = Math.min(900, (maxX - minX) * 0.4);
  const stageCx = (minX + maxX) / 2;
  return {
    baseViewBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    stage: { x: stageCx - stageW / 2, y: stageY, width: stageW, height: stageH, cx: stageCx },
  };
}
