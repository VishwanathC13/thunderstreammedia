const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../../prismaClient');
const { requireAuth, requireRole, JWT_SECRET } = require('../../middleware/auth');
const { listCalendarEvents } = require('../../integrations/calendarSync');

const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${BACKEND_URL}/api/admin/google-calendar/callback`;

// Google's redirect back to us is a plain browser navigation — it can't
// carry an Authorization header, so /connect (which *is* hit with our own
// JWT, via a query param since it's also a navigation, not a fetch) hands
// off to Google holding a short-lived, single-use `state` nonce as CSRF
// protection instead of a session.
const pendingStates = new Map(); // state -> expiry timestamp
const STATE_TTL_MS = 10 * 60 * 1000;

function isConfigured() {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

// GET /api/admin/google-calendar/connect?token=<jwt>
// A plain link-navigation (not an XHR), so auth arrives via query param
// instead of the usual Authorization header.
router.get('/connect', (req, res) => {
  if (!isConfigured()) return res.status(400).send('Google OAuth is not configured on the server yet.');

  let user;
  try {
    user = jwt.verify(req.query.token || '', JWT_SECRET);
  } catch {
    return res.status(401).send('Invalid or expired session — sign in again and retry.');
  }
  if (user.role !== 'OWNER') return res.status(403).send('Only an Owner can connect Google Calendar.');

  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now() + STATE_TTL_MS);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token every time, not just on first-ever consent
    scope: 'openid email https://www.googleapis.com/auth/calendar.events',
    state,
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// GET /api/admin/google-calendar/callback — hit directly by Google's
// redirect, so no Authorization header is possible here; the `state`
// nonce is what proves this follows a connect request we issued.
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/admin/settings?calendar=error&reason=${encodeURIComponent(error)}`);

  const expiry = pendingStates.get(state);
  pendingStates.delete(state);
  if (!expiry || expiry < Date.now()) {
    return res.redirect(`${FRONTEND_URL}/admin/settings?calendar=error&reason=expired`);
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenData.error_description || 'Token exchange failed');
    if (!tokenData.refresh_token) throw new Error('Google did not return a refresh token — try disconnecting in your Google account permissions and reconnecting.');

    // id_token is a JWT Google itself just issued us over an authenticated
    // HTTPS call to its own token endpoint — safe to decode without
    // re-verifying the signature here.
    const payload = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64').toString());

    await prisma.studioConfig.upsert({
      where: { id: 1 },
      update: { googleCalendarRefreshToken: tokenData.refresh_token, googleCalendarEmail: payload.email },
      create: { id: 1, googleCalendarRefreshToken: tokenData.refresh_token, googleCalendarEmail: payload.email },
    });

    res.redirect(`${FRONTEND_URL}/admin/settings?calendar=connected`);
  } catch (err) {
    console.error('Google Calendar connect failed:', err.message);
    res.redirect(`${FRONTEND_URL}/admin/settings?calendar=error&reason=${encodeURIComponent(err.message)}`);
  }
});

router.get('/status', requireAuth, requireRole('OWNER'), async (req, res) => {
  const config = await prisma.studioConfig.findUnique({ where: { id: 1 } });
  res.json({
    configured: isConfigured(),
    connected: Boolean(config?.googleCalendarRefreshToken),
    email: config?.googleCalendarEmail || null,
  });
});

// Read-only feed for the admin calendar view (same roles that can open it).
router.get('/events', requireAuth, requireRole('OWNER', 'SALES'), async (req, res) => {
  const from = new Date(String(req.query.from));
  const to = new Date(String(req.query.to));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return res.status(400).json({ error: 'from/to must be ISO dates' });
  try {
    res.json(await listCalendarEvents({ timeMin: from.toISOString(), timeMax: to.toISOString() }));
  } catch (err) {
    console.error('google calendar events fetch failed:', err.message);
    res.status(502).json({ error: err.message });
  }
});

router.post('/disconnect', requireAuth, requireRole('OWNER'), async (req, res) => {
  await prisma.studioConfig.update({
    where: { id: 1 },
    data: { googleCalendarRefreshToken: null, googleCalendarEmail: null },
  });
  res.json({ ok: true });
});

module.exports = router;
