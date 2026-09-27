// Outward sync to Google Calendar (spec 3.6 — explicitly optional/stub in
// the spec itself, but implemented for real here). Uses a standard OAuth
// "Connect Google Calendar" flow (refresh token stored per-studio in
// StudioConfig) rather than a service account JSON key — some Google
// Workspace/Cloud orgs block service-account key creation entirely via
// the iam.disableServiceAccountKeyCreation policy, and the OAuth consent
// flow isn't affected by that at all. See routes/admin/googleCalendar.js
// for the connect/callback/disconnect endpoints.
const prisma = require('../prismaClient');

async function getConfig() {
  return prisma.studioConfig.findUnique({ where: { id: 1 } });
}

function isGoogleCalendarConfigured() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

// Google access tokens are typically valid ~1hr, but every calendar read
// (opening the admin Bookings & Calendar page, paging month/week/day) was
// exchanging the refresh token for a brand new one first — two sequential
// round trips to Google before any data could load, adding ~1.4s to every
// view. Cached in memory (single Node process, one studio) and refreshed
// only once actually near expiry, with a minute of buffer for clock drift.
let cachedToken = null; // { accessToken, expiresAt }

async function getAccessToken(refreshToken) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.accessToken;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Google token refresh failed');
  cachedToken = { accessToken: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return cachedToken.accessToken;
}

async function syncBookingToCalendar({ booking }) {
  const config = await getConfig();

  if (!isGoogleCalendarConfigured() || !config?.googleCalendarRefreshToken) {
    console.log(`[MOCK:googleCalendar] would sync booking #${booking.id} (${booking.date})`);
    return { status: 'mocked-synced', mocked: true };
  }

  const start = new Date(booking.date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // 2hr placeholder block

  const accessToken = await getAccessToken(config.googleCalendarRefreshToken);
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: `Thunderstream Media booking #${booking.id}`,
      description: `Source: ${booking.source}${booking.notes ? ` — ${booking.notes}` : ''}`,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Google Calendar sync failed');
  return { status: 'synced', mocked: false, eventId: data.id, htmlLink: data.htmlLink };
}

// Read-side: events on the connected calendar within [timeMin, timeMax].
// Events this app pushed itself (booking syncs) are dropped — those already
// show up as bookings, so returning them would draw every synced booking twice.
async function listCalendarEvents({ timeMin, timeMax }) {
  const config = await getConfig();
  if (!isGoogleCalendarConfigured() || !config?.googleCalendarRefreshToken) {
    return { connected: false, events: [] };
  }

  const accessToken = await getAccessToken(config.googleCalendarRefreshToken);
  const params = new URLSearchParams({
    timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Google Calendar fetch failed');

  const events = (data.items || [])
    .filter((e) => e.status !== 'cancelled' && !(e.summary || '').startsWith('Thunderstream Media booking #'))
    .map((e) => ({
      id: e.id,
      title: e.summary || '(No title)',
      allDay: Boolean(e.start?.date),
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      location: e.location || null,
      description: e.description || null,
      htmlLink: e.htmlLink,
    }));
  return { connected: true, events };
}

// Called on disconnect/reconnect (see routes/admin/googleCalendar.js) so a
// cached token for the old refresh token is never reused against a new one.
function clearAccessTokenCache() {
  cachedToken = null;
}

module.exports = { syncBookingToCalendar, listCalendarEvents, isGoogleCalendarConfigured, clearAccessTokenCache };
