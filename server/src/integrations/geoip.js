// Real (not mocked) GeoIP lookup — geoip-lite ships an offline database,
// no external account needed. Production note (spec 3.3): this runs at
// the app-server layer here; the spec recommends moving it to the edge
// (Cloudflare Workers/Vercel Edge) so blocked traffic never reaches the
// server at all — swap this module for `request.cf.country` (Cloudflare)
// or similar when that migration happens.
const geoip = require('geoip-lite');

function resolveCountry(ip) {
  if (!ip) return null;
  // strip IPv6-mapped-IPv4 prefix, and handle local/dev requests
  const clean = ip.replace('::ffff:', '');
  if (clean === '::1' || clean === '127.0.0.1') return null;
  const geo = geoip.lookup(clean);
  return geo?.country || null;
}

module.exports = { resolveCountry };
