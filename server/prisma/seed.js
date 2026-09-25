const bcrypt = require('bcryptjs');
const prisma = require('../src/prismaClient');

const SERVICES = [
  { key: 'video', label: 'Videography', spec: '4K / 60FPS', description: 'Cinematic capture for brand films, events, and campaigns.', basePrice: 45000, unit: 'per day' },
  { key: 'photo', label: 'Photography', spec: 'RAW / 45MP', description: 'Editorial and commercial stills, on location or in-studio.', basePrice: 25000, unit: 'per day' },
  { key: 'live', label: 'Livestreaming', spec: 'MULTI-CAM / LOW-LATENCY', description: 'Broadcast-grade streams for conferences and ticketed events.', basePrice: 60000, unit: 'per day' },
  { key: 'post', label: 'Post Production', spec: 'EDITING / COLOR / MIX', description: 'Editing, color grading, and audio mixing to finish your project.', basePrice: 20000, unit: 'per project' },
  { key: 'product', label: 'Product Shoots', spec: '4K / DNG', description: 'Catalogue, hero, and lifestyle shots for e-commerce and launches.', basePrice: 18000, unit: 'per day' },
  { key: 'corporate', label: 'Corporate & Meetings', spec: 'END-TO-END / MULTI-PLATFORM', description: 'Full AV production for town halls, summits, and hybrid meetings.', basePrice: 50000, unit: 'per day' },
];

const WORK = [
  { title: "Northfield Summit '26", client: 'Northfield Group', tag: 'corporate', durationLabel: '03:12', hue: 28, sortOrder: 0 },
  { title: 'Atlas Running — Launch Film', client: 'Atlas', tag: 'product', durationLabel: '00:48', hue: 12, sortOrder: 1 },
  { title: 'Skyline Residences', client: 'Meridian Realty', tag: 'video', durationLabel: '01:35', hue: 205, sortOrder: 2 },
  { title: 'The Long Take, Ep. 14', client: 'The Long Take', tag: 'post', durationLabel: '41:20', hue: 340, sortOrder: 3 },
  { title: 'Lumen Product Drop', client: 'Lumen', tag: 'product', durationLabel: '00:31', hue: 45, sortOrder: 4 },
  { title: 'Founders Live: Bengaluru', client: 'Founders Live', tag: 'corporate', durationLabel: '02:04:00', hue: 190, sortOrder: 5 },
];

async function main() {
  await prisma.studioConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1, maxBookingsPerDay: 2 } });

  for (const s of SERVICES) {
    await prisma.service.upsert({ where: { key: s.key }, update: s, create: s });
  }

  for (const w of WORK) {
    const existing = await prisma.workItem.findFirst({ where: { title: w.title } });
    if (!existing) await prisma.workItem.create({ data: w });
  }

  const ownerEmail = process.env.SEED_OWNER_EMAIL || 'admin@thunderstreammedia.com';
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || 'changeme123';
  const existingOwner = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!existingOwner) {
    await prisma.user.create({
      data: {
        email: ownerEmail,
        passwordHash: await bcrypt.hash(ownerPassword, 10),
        name: 'Studio Owner',
        role: 'OWNER',
      },
    });
    console.log(`Seeded owner user: ${ownerEmail} / ${ownerPassword} (change this password after first login)`);
  }

  const eventStart = new Date();
  eventStart.setDate(eventStart.getDate() + 14);
  eventStart.setHours(18, 30, 0, 0);
  const eventEnd = new Date(eventStart);
  eventEnd.setHours(eventEnd.getHours() + 2);

  const existingEvent = await prisma.event.findUnique({ where: { slug: 'founders-live-bengaluru' } });
  if (!existingEvent) {
    await prisma.event.create({
      data: {
        slug: 'founders-live-bengaluru',
        title: 'Founders Live: Bengaluru',
        description: 'A ticketed evening of founder talks, filmed and livestreamed by Thunderstream Media.',
        start: eventStart,
        end: eventEnd,
        venue: 'UB City',
        capacity: 200,
        status: 'PUBLISHED',
        geoRestricted: false,
        ticketTiers: {
          create: [{ name: 'General', price: 1200, quantityTotal: 150 }],
        },
      },
    });
  }

  // --- Assigned-seating demo: a small venue layout + one seated event,
  // so the seat-map feature has something to exercise without needing the
  // admin Venue Layout editor first. Two zones, 5 rows x 10 seats.
  let venue = await prisma.venue.findFirst({ where: { name: 'Studio A — Screening Room' } });
  if (!venue) {
    venue = await prisma.venue.create({ data: { name: 'Studio A — Screening Room', city: 'Bengaluru' } });
    const frontZone = await prisma.seatZone.create({ data: { venueId: venue.id, name: 'Front Row', colorHex: '#F0362A', basePrice: 1500, sortOrder: 0 } });
    const generalZone = await prisma.seatZone.create({ data: { venueId: venue.id, name: 'General', colorHex: '#6FA8D6', basePrice: 900, sortOrder: 1 } });

    const rows = ['A', 'B', 'C', 'D', 'E'];
    const seatsData = [];
    rows.forEach((rowLabel, rowIndex) => {
      const zoneId = rowIndex < 2 ? frontZone.id : generalZone.id;
      for (let seatNumber = 1; seatNumber <= 10; seatNumber++) {
        seatsData.push({
          venueId: venue.id,
          zoneId,
          rowLabel,
          seatNumber,
          posX: seatNumber * 32,
          posY: rowIndex * 32,
        });
      }
    });
    await prisma.seat.createMany({ data: seatsData });
  }

  const seatedEventStart = new Date();
  seatedEventStart.setDate(seatedEventStart.getDate() + 21);
  seatedEventStart.setHours(19, 0, 0, 0);
  const seatedEventEnd = new Date(seatedEventStart);
  seatedEventEnd.setHours(seatedEventEnd.getHours() + 2);

  let seatedEvent = await prisma.event.findUnique({ where: { slug: 'private-screening-night' } });
  if (!seatedEvent) {
    seatedEvent = await prisma.event.create({
      data: {
        slug: 'private-screening-night',
        title: 'Private Screening Night',
        description: 'An assigned-seating preview screening in our studio, shot and cut by Thunderstream Media.',
        start: seatedEventStart,
        end: seatedEventEnd,
        venue: venue.name,
        status: 'PUBLISHED',
        geoRestricted: false,
        seatingMode: true,
        seatingVenueId: venue.id,
      },
    });
  }

  const seats = await prisma.seat.findMany({ where: { venueId: venue.id }, include: { zone: true } });
  await prisma.eventSeat.createMany({
    data: seats.map((s) => ({ eventId: seatedEvent.id, seatId: s.id, price: s.zone.basePrice })),
    skipDuplicates: true,
  });

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
