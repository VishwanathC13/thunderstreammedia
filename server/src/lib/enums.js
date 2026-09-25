// Canonical value lists for the string columns that stand in for enums —
// SQLite has no native Prisma enum support, so these are validated here
// (via zod, at the route layer) instead of at the DB layer.

const Role = ['OWNER', 'SALES', 'EDITOR', 'FINANCE'];
const ContactSource = ['WEBSITE', 'INSTAGRAM', 'WHATSAPP', 'FACEBOOK', 'MANUAL'];
const QuoteStatus = ['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'CONVERTED', 'EXPIRED'];
const SendChannel = ['EMAIL', 'WHATSAPP'];
const BookingStatus = ['PENDING', 'CONFIRMED', 'CANCELLED'];
const MeetingProvider = ['ZOOM', 'TEAMS', 'WEBEX'];
const EventStatus = ['DRAFT', 'PUBLISHED', 'CANCELLED'];
const TicketStatus = ['ISSUED', 'CHECKED_IN', 'CANCELLED'];
const PaymentProvider = ['RAZORPAY'];
const PaymentStatus = ['CREATED', 'CAPTURED', 'FAILED', 'REFUNDED'];
const GeoMode = ['ALLOW', 'BLOCK'];
const GeoScope = ['GLOBAL', 'EVENT'];
// HELD is deliberately not in this list -- it's Redis-only ephemeral state,
// never written to EventSeat.status (see server/src/lib/seatHold.js).
const EventSeatStatus = ['AVAILABLE', 'BOOKED', 'BLOCKED'];

module.exports = {
  Role,
  ContactSource,
  QuoteStatus,
  SendChannel,
  BookingStatus,
  MeetingProvider,
  EventStatus,
  TicketStatus,
  PaymentProvider,
  PaymentStatus,
  GeoMode,
  GeoScope,
  EventSeatStatus,
};
