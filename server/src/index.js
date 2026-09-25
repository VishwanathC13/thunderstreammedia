require('dotenv').config();
require('./lib/patchAsyncErrors'); // must load before any route file constructs a router
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const auth = require('./routes/auth');
const quotes = require('./routes/quotes');
const bookings = require('./routes/bookings');
const services = require('./routes/services');
const work = require('./routes/work');
const events = require('./routes/events');
const holds = require('./routes/holds');
const webhooks = require('./routes/webhooks');

const adminClients = require('./routes/admin/clients');
const adminBookings = require('./routes/admin/bookings');
const adminServices = require('./routes/admin/services');
const adminWork = require('./routes/admin/work');
const adminMedia = require('./routes/admin/media');
const adminQuotes = require('./routes/admin/quotes');
const adminEvents = require('./routes/admin/events');
const adminVenues = require('./routes/admin/venues');
const adminGeorules = require('./routes/admin/georules');
const adminIntegrations = require('./routes/admin/integrations');
const adminUsers = require('./routes/admin/users');
const adminSettings = require('./routes/admin/settings');
const adminGoogleCalendar = require('./routes/admin/googleCalendar');
const adminOverview = require('./routes/admin/overview');

const { UPLOAD_DIR } = require('./integrations/storage');
const { geoblock } = require('./middleware/geoblock');
const prisma = require('./prismaClient');

const app = express();
app.use(cors(process.env.NODE_ENV === 'production' ? { origin: process.env.FRONTEND_URL } : undefined));
app.use(bodyParser.json());
app.use('/media', express.static(UPLOAD_DIR));

app.get('/health', (req, res) => res.json({ ok: true }));

// Geoblocking applies to public-facing traffic only — never to auth/admin,
// so a GLOBAL block rule can't accidentally lock the team out of their
// own dashboard. Spec 3.3's use cases (fraud-prone regions, licensing
// restrictions) are about public inquiry/booking/event traffic.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/auth') || req.path.startsWith('/api/webhooks')) return next();
  geoblock(req, res, next);
});

app.use('/api/webhooks', webhooks);
app.use('/api/auth', auth);
app.use('/api/quotes', quotes);
app.use('/api/bookings', bookings);
app.use('/api/services', services);
app.use('/api/work', work);
app.use('/api/events', events);
app.use('/api/holds', holds);

app.use('/api/admin/clients', adminClients);
app.use('/api/admin/bookings', adminBookings);
app.use('/api/admin/services', adminServices);
app.use('/api/admin/work', adminWork);
app.use('/api/admin/media', adminMedia);
app.use('/api/admin/quotes', adminQuotes);
app.use('/api/admin/events', adminEvents);
app.use('/api/admin/venues', adminVenues);
app.use('/api/admin/georules', adminGeorules);
app.use('/api/admin/integrations', adminIntegrations);
app.use('/api/admin/users', adminUsers);
app.use('/api/admin/settings', adminSettings);
app.use('/api/admin/google-calendar', adminGoogleCalendar);
app.use('/api/admin/overview', adminOverview);

// Final safety net: any error forwarded via next(err) — including ones
// auto-caught from rejected route-handler promises by patchAsyncErrors —
// lands here instead of crashing the process or leaking a stack trace.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server listening on ${port}`));

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
