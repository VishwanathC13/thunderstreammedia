// Production bootstrap: creates only what a real launch needs — the studio
// settings row, your price-list services, and the owner login. Unlike
// prisma/seed.js (dev demo data: fake portfolio items, sample events, a demo
// venue), this never creates placeholder content. Safe to re-run: every step
// skips what already exists and never overwrites edited prices or passwords.
//
//   SEED_OWNER_EMAIL=... SEED_OWNER_PASSWORD=... node prisma/seed-production.js
const bcrypt = require('bcryptjs');
const prisma = require('../src/prismaClient');

// Quote rate card from the 2026 price list (inactive = not shown on the
// public site, still selectable when building quotes).
const SERVICES = [
  {"key": "trad_photo_4h", "label": "Traditional Photography — 4 Hours", "spec": "PHOTOGRAPHY", "description": "Traditional-style photography coverage, 4-hour block.", "basePrice": 7000, "unit": "flat rate", "active": false},
  {"key": "trad_photo_8h", "label": "Traditional Photography — 8 Hours", "spec": "PHOTOGRAPHY", "description": "Traditional-style photography coverage, 8-hour block.", "basePrice": 14000, "unit": "flat rate", "active": false},
  {"key": "candid_photo_4h", "label": "Candid Photography — 4 Hours", "spec": "PHOTOGRAPHY", "description": "Candid photography coverage, 4-hour block.", "basePrice": 10000, "unit": "flat rate", "active": false},
  {"key": "candid_photo_8h", "label": "Candid Photography — 8 Hours", "spec": "PHOTOGRAPHY", "description": "Candid photography coverage, 8-hour block.", "basePrice": 16000, "unit": "flat rate", "active": false},
  {"key": "trad_video_4h", "label": "Traditional Videography — 4 Hours", "spec": "VIDEOGRAPHY", "description": "Traditional-style videography coverage, 4-hour block.", "basePrice": 7000, "unit": "flat rate", "active": false},
  {"key": "trad_video_8h", "label": "Traditional Videography — 8 Hours", "spec": "VIDEOGRAPHY", "description": "Traditional-style videography coverage, 8-hour block.", "basePrice": 14000, "unit": "flat rate", "active": false},
  {"key": "cine_video_4h", "label": "Cinematic Videography — 4 Hours", "spec": "VIDEOGRAPHY", "description": "Cinematic videography coverage, 4-hour block.", "basePrice": 10000, "unit": "flat rate", "active": false},
  {"key": "cine_video_8h", "label": "Cinematic Videography — 8 Hours", "spec": "VIDEOGRAPHY", "description": "Cinematic videography coverage, 8-hour block.", "basePrice": 15000, "unit": "flat rate", "active": false},
  {"key": "livestream_4h", "label": "Livestreaming — 4 Hours", "spec": "LIVESTREAMING", "description": "Single-camera livestream coverage, 4-hour block.", "basePrice": 7000, "unit": "flat rate", "active": false},
  {"key": "livestream_8h", "label": "Livestreaming — 8 Hours", "spec": "LIVESTREAMING", "description": "Single-camera livestream coverage, 8-hour block.", "basePrice": 14000, "unit": "flat rate", "active": false},
  {"key": "cam2_live_half", "label": "2 Camera Mixing with Livestreaming — Half Day", "spec": "LIVESTREAMING", "description": "2-camera live mix with livestreaming, half-day.", "basePrice": 25000, "unit": "flat rate", "active": false},
  {"key": "cam2_live_full", "label": "2 Camera Mixing with Livestreaming — Full Day", "spec": "LIVESTREAMING", "description": "2-camera live mix with livestreaming, full-day.", "basePrice": 40000, "unit": "flat rate", "active": false},
  {"key": "cam3_live_half", "label": "3 Camera Mixing with Livestreaming — Half Day", "spec": "LIVESTREAMING", "description": "3-camera live mix with livestreaming, half-day.", "basePrice": 30000, "unit": "flat rate", "active": false},
  {"key": "cam3_live_full", "label": "3 Camera Mixing with Livestreaming — Full Day", "spec": "LIVESTREAMING", "description": "3-camera live mix with livestreaming, full-day.", "basePrice": 45000, "unit": "flat rate", "active": false},
  {"key": "cam2_zoom_half", "label": "2 Camera Mixing with Zoom Meeting — Half Day", "spec": "CORPORATE", "description": "2-camera mix for Zoom meetings, half-day.", "basePrice": 25000, "unit": "flat rate", "active": false},
  {"key": "cam2_zoom_full", "label": "2 Camera Mixing with Zoom Meeting — Full Day", "spec": "CORPORATE", "description": "2-camera mix for Zoom meetings, full-day.", "basePrice": 40000, "unit": "flat rate", "active": false},
  {"key": "cam3_zoom_half", "label": "3 Camera Mixing with Zoom Meeting — Half Day", "spec": "CORPORATE", "description": "3-camera mix for Zoom meetings, half-day.", "basePrice": 30000, "unit": "flat rate", "active": false},
  {"key": "cam3_zoom_full", "label": "3 Camera Mixing with Zoom Meeting — Full Day", "spec": "CORPORATE", "description": "3-camera mix for Zoom meetings, full-day.", "basePrice": 45000, "unit": "flat rate", "active": false}
];

async function main() {
  const ownerEmail = process.env.SEED_OWNER_EMAIL;
  const ownerPassword = process.env.SEED_OWNER_PASSWORD;
  if (!ownerEmail || !ownerPassword || ownerPassword.length < 12) {
    throw new Error('Set SEED_OWNER_EMAIL and a SEED_OWNER_PASSWORD of at least 12 characters');
  }

  await prisma.studioConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1, maxBookingsPerDay: 20 } });

  for (const s of SERVICES) {
    await prisma.service.upsert({ where: { key: s.key }, update: {}, create: s });
  }

  const existing = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!existing) {
    await prisma.user.create({
      data: { email: ownerEmail, passwordHash: await bcrypt.hash(ownerPassword, 10), name: 'Studio Owner', role: 'OWNER' },
    });
    console.log(`Created owner login "${ownerEmail}".`);
  } else {
    console.log(`Owner "${ownerEmail}" already exists — left unchanged.`);
  }
  console.log(`Ready: ${SERVICES.length} services, studio settings, owner login.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
