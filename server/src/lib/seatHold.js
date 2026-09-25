// Redis-backed seat holds, mirroring the seat-booking-system demo's split:
// Postgres (EventSeat.status) is the durable AVAILABLE/BOOKED/BLOCKED
// state; Redis holds ephemeral per-seat TTL locks for whoever is mid-
// checkout. A seat reads as effectively "held" only while its Redis key
// exists — no cron/cleanup job needed, expiry does that for free.
const crypto = require('crypto');
const redis = require('./redis');

const HOLD_TTL_SECONDS = Number(process.env.HOLD_TTL_SECONDS || 600);

const seatKey = (eventId, seatId) => `seat:hold:${eventId}:${seatId}`;
const tokenKey = (holdToken) => `hold:${holdToken}`;

/**
 * Attempts to lock every seatId for this event, all-or-nothing. On any
 * conflict, rolls back whatever it already acquired and reports which
 * seatIds were already taken — same guarantee (and the same reason it's
 * needed) as the original: two buyers racing for an overlapping set of
 * seats must never both end up with a partial hold.
 */
async function createHold(eventId, seatIds) {
  const holdToken = crypto.randomUUID();
  const acquired = [];

  for (const seatId of seatIds) {
    const key = seatKey(eventId, seatId);
    const result = await redis.set(key, holdToken, 'EX', HOLD_TTL_SECONDS, 'NX');
    if (result === 'OK') {
      acquired.push(seatId);
    } else {
      // Someone else holds (or already booked through) this seat -- bail
      // out and release everything we grabbed in this attempt.
      if (acquired.length) await redis.del(...acquired.map((id) => seatKey(eventId, id)));
      const conflictSeatIds = [];
      for (const id of seatIds) {
        if (id === seatId || (await redis.exists(seatKey(eventId, id)))) conflictSeatIds.push(id);
      }
      return { ok: false, conflictSeatIds: [...new Set(conflictSeatIds)] };
    }
  }

  const expiresAt = new Date(Date.now() + HOLD_TTL_SECONDS * 1000).toISOString();
  await redis.set(tokenKey(holdToken), JSON.stringify({ eventId, seatIds, expiresAt }), 'EX', HOLD_TTL_SECONDS);
  return { ok: true, holdToken, expiresAt, seatIds };
}

async function getHold(holdToken) {
  const raw = await redis.get(tokenKey(holdToken));
  return raw ? JSON.parse(raw) : null;
}

async function releaseHold(holdToken) {
  const hold = await getHold(holdToken);
  if (!hold) return false;
  await redis.del(tokenKey(holdToken), ...hold.seatIds.map((id) => seatKey(hold.eventId, id)));
  return true;
}

/** For seatmap reads: which of these seatIds currently have a live Redis hold. */
async function heldSeatIds(eventId, seatIds) {
  if (!seatIds.length) return new Set();
  const keys = seatIds.map((id) => seatKey(eventId, id));
  const results = await redis.mget(...keys);
  const held = new Set();
  results.forEach((val, i) => { if (val) held.add(seatIds[i]); });
  return held;
}

module.exports = { createHold, getHold, releaseHold, heldSeatIds, HOLD_TTL_SECONDS };
