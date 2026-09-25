const prisma = require('../prismaClient');
const { resolveCountry } = require('../integrations/geoip');

// Fails open when no GeoRule rows exist — never silently locks out all
// traffic before rules are configured (spec 3.3: "access-control layer,
// not a security boundary"). GLOBAL rules apply everywhere this
// middleware is mounted; EVENT-scoped rules only matter on routes that
// check req.geoBlocked for a specific event (see routes/events.js).
async function geoblock(req, res, next) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    const country = resolveCountry(ip);
    req.visitorCountry = country;

    if (!country) return next();

    const globalRules = await prisma.geoRule.findMany({ where: { scope: 'GLOBAL' } });
    if (globalRules.length > 0) {
      const blockRules = globalRules.filter((r) => r.mode === 'BLOCK');
      const allowRules = globalRules.filter((r) => r.mode === 'ALLOW');
      const isBlocked = blockRules.some((r) => r.countryCode === country);
      const isExplicitlyAllowed = allowRules.length === 0 || allowRules.some((r) => r.countryCode === country);
      if (isBlocked || !isExplicitlyAllowed) {
        return res.status(403).json({ error: 'Access restricted in your region' });
      }
    }

    next();
  } catch (err) {
    console.error('geoblock middleware error, failing open:', err);
    next();
  }
}

// For event-specific gating: sets req.geoBlocked instead of hard-403ing,
// so the route can still return event metadata with a "blocked" flag.
async function checkEventGeoRestriction(req, res, next) {
  try {
    const event = await prisma.event.findUnique({ where: { slug: req.params.slug } });
    if (!event?.geoRestricted) return next();

    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    const country = resolveCountry(ip);
    if (!country) return next();

    const rules = await prisma.geoRule.findMany({ where: { scope: 'EVENT', ruleTargetEventId: event.id } });
    if (rules.length === 0) return next();

    const blockRules = rules.filter((r) => r.mode === 'BLOCK');
    const allowRules = rules.filter((r) => r.mode === 'ALLOW');
    const isBlocked = blockRules.some((r) => r.countryCode === country);
    const isExplicitlyAllowed = allowRules.length === 0 || allowRules.some((r) => r.countryCode === country);
    req.geoBlocked = isBlocked || !isExplicitlyAllowed;
    next();
  } catch (err) {
    console.error('event geo-restriction check error, failing open:', err);
    next();
  }
}

module.exports = { geoblock, checkEventGeoRestriction };
