# Enterprise Website — Technical Architecture & Specification

### For a Full-Service Production House (Videography, Photography, Livestreaming, Post Production, Product Shoots, Corporate Video)

---

## 1. Executive Summary

This document lays out the architecture for a full production-house website with a client-facing site and an admin dashboard, covering: geoblocking, video-conferencing integration (Zoom/Teams/Webex), ticketed events, calendar/date blocking (including bookings confirmed via Meta channels), automated quotation generation (WhatsApp/email), and a custom video player.

This is an enterprise-grade build. It needs a real backend, database, hosting, and API credentials for each third-party service — none of which can be provisioned inside a chat environment. This spec is the blueprint your dev team (or Claude Code, working with you step by step) would use to actually build it.

---

## 2. System Overview

**Two applications, one shared backend:**

1. **Public Website** — portfolio, service pages, booking flow, ticketed event pages, client quotation requests, embedded video player.
2. **Admin Dashboard** — internal tool for your team to manage bookings, calendar, quotations, events, clients, and content.

**Shared backend** exposes APIs both apps consume, and handles all third-party integrations.

```
┌─────────────────┐      ┌─────────────────┐
│  Public Website   │      │  Admin Dashboard  │
│  (Next.js)        │      │  (React/Next.js)  │
└────────┬─────────┘      └────────┬─────────┘
         │                          │
         └───────────┬──────────────┘
                      │
              ┌───────▼────────┐
              │   Backend API    │
              │ (Node.js/NestJS) │
              └───────┬────────┘
                      │
     ┌────────────────┼─────────────────────────┐
     │                │                          │
┌────▼────┐   ┌────────▼─────────┐    ┌───────────▼──────────┐
│ Database │   │ Third-party APIs │    │  Storage (video/img)   │
│ Postgres │   │ Zoom/Teams/Webex │    │  S3 / Cloudflare R2     │
│          │   │ WhatsApp/Email   │    │  + CDN + video streaming│
│          │   │ Meta Graph API   │    │                          │
│          │   │ Geo-IP service   │    │                          │
└──────────┘   └──────────────────┘    └──────────────────────────┘
```

---

## 3. Core Modules

### 3.1 Public Website

- Home, Services (videography, photography, livestreaming, post production, product shoots, corporate), Portfolio/reel gallery, About, Contact.
- Service-specific inquiry forms feeding into the quotation engine.
- Embedded custom video player for showreels/case studies.
- Event pages for ticketed livestreams or in-person shoots/events.

### 3.2 Admin Dashboard

Role-based internal tool. Core sections:

- **Bookings & Calendar** — see all confirmed/pending dates, manually block dates, view source (website, Instagram, WhatsApp, Facebook).
- **Quotation Builder** — select services + line items → auto-generate a quote → send via WhatsApp or email.
- **Events & Ticketing** — create ticketed events, set capacity/pricing, view attendee list, check-in via QR.
- **Client/CRM view** — inquiry history, past bookings, contact info.
- **Content management** — upload/manage portfolio media, case studies.
- **User roles** — Admin, Sales/Booking staff, Editor (content only).

### 3.3 Geoblocking

- On each request, resolve visitor IP → country/region using a GeoIP service (e.g., MaxMind GeoIP2, or Cloudflare's built-in geo headers if you're behind Cloudflare).
- Backend/middleware checks an allow-list or block-list (e.g., "block traffic from X countries" or "restrict certain event pages to specific regions").
- Best implemented at the **edge** (Cloudflare Workers or Vercel Edge Middleware) rather than app-server level — faster and cheaper since blocked traffic never hits your server.
- Use case examples: restricting ticketed livestream access by region (licensing), or blocking regions with high fraud/spam inquiry rates.

### 3.4 Video Conferencing Integration (Zoom / Teams / Webex)

For corporate end-to-end video meetings and consultations:

- **Zoom** — Zoom Meeting SDK or Server-to-Server OAuth API to auto-create meetings when a corporate consultation is booked, embed the join link/SDK directly in your dashboard or client portal.
- **Microsoft Teams** — Microsoft Graph API (`/onlineMeetings` endpoint) to create and manage Teams meetings programmatically.
- **Webex** — Webex Meetings REST API for the same purpose.
- Recommended flow: client books a "corporate consultation" slot → backend auto-creates a meeting on the chosen platform → confirmation email/WhatsApp with the join link is sent automatically → meeting appears in admin dashboard.
- Each platform requires its own developer app registration + OAuth credentials, and (for Zoom/Webex) may need a paid plan tier for API access.

### 3.5 Ticketed Events

- Event creation (date, time, capacity, price tiers, description, cover media).
- Payment integration for paid tickets (Razorpay/Stripe depending on your market — you're in India, so **Razorpay** is likely the natural fit, with Stripe as an alternative for international clients).
- Digital ticket generation (QR code) emailed/WhatsApp'd to buyer.
- Check-in scanning tool (mobile-friendly admin view) for event day.
- Optional: livestream ticketed events gated behind login + geoblocking (see 3.3).

### 3.6 Booking & Calendar (incl. Meta-channel date blocking)

This is the module that covers what you described.

**Flow:**

1. A booking/date-hold can originate from three places:
   - Directly on the website (client picks a date, submits inquiry).
   - Manually entered by your team after a conversation on **Instagram, WhatsApp, or Facebook**.
   - (Later phase) Semi-automated via Meta's APIs — see below.
2. The moment a date is confirmed or held, it's written to a central **calendar/bookings table**.
3. That date immediately shows as unavailable on the public website's booking calendar — no double-booking across channels.

**Two implementation tiers:**

- **Tier 1 (recommended to start):** Manual confirm. Your team gets the DM on Instagram/WhatsApp/Facebook as normal, then clicks "Block Date" in the admin dashboard, picks the client + service + date. Instant, reliable, no API fragility. This alone solves your core problem.
- **Tier 2 (later, more complex):** Semi-automation using the **Meta Graph API** (Instagram Messaging API, WhatsApp Business Platform API, Messenger Platform API) so inbound messages appear inside your admin dashboard as an "inbox," and your team confirms bookings from there without switching apps. This requires a verified Meta Business/WhatsApp Business Account, app review by Meta, and ongoing webhook infrastructure. It doesn't remove the human confirmation step (Meta doesn't let you auto-detect "this message means block this date" reliably) — it just centralizes the conversations.
- Calendar itself can sync outward too, via the standard **Google Calendar / Outlook Calendar API**, so your team's personal calendars stay in sync with the website.

- ### 3.7 Quotation Engine
- Admin (or client, via a guided form) selects services (e.g., "Corporate video, 2 days, post-production add-on") → system calculates pricing from a configurable rate table.
- Generates a branded PDF quotation.
- Sends via **WhatsApp Business API** (template message + PDF attachment) or **email** (SendGrid/Postmark/SES).
- Tracks quote status: sent → viewed → accepted → converted to booking.

### 3.8 Video Player

- Custom-branded player (not a bare embed) for showreels, case studies, ticketed livestream playback.
- Recommended: **Mux** or **Cloudflare Stream** for hosting/transcoding/adaptive bitrate streaming + a player library like **Video.js** or **Plyr** for the front-end, styled to match your brand.
- For live streaming specifically: Mux Live or Cloudflare Stream Live, or direct RTMP ingestion from your production gear into a livestream player embedded on ticketed event pages.

---

## 4. Recommended Tech Stack

| Layer                       | Recommendation                                   | Why                                                        |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| Frontend (site + dashboard) | Next.js (React)                                  | SEO-friendly for public site, same framework for both apps |
| Backend                     | Node.js + NestJS (or Express)                    | Clean structure for many integrations/modules              |
| Database                    | PostgreSQL                                       | Relational data (bookings, clients, events) fits well      |
| Auth                        | Auth.js / Clerk                                  | Handles admin roles + client login for ticketed events     |
| Hosting                     | Vercel (frontend) + Railway/Render/AWS (backend) | Fast to ship, scales later                                 |
| Media storage/streaming     | Cloudflare R2 + Cloudflare Stream, or Mux        | Cost-effective video delivery at scale                     |
| Payments                    | Razorpay (India)                                 | Local payment methods, UPI support                         |
| Geoblocking                 | Cloudflare Edge / Workers                        | Blocks at the edge, cheapest and fastest                   |
| Messaging                   | WhatsApp Business Platform API, SendGrid (email) | Quotation delivery                                         |
| Calendar sync               | Google Calendar API / Microsoft Graph            | Two-way sync with team calendars                           |

---

## 5. Third-Party Accounts/Credentials You'll Need to Set Up

- Zoom developer app (Server-to-Server OAuth)
- Microsoft Azure AD app registration (for Teams/Graph API)
- Webex developer account + integration
- Meta Business Account + WhatsApp Business Platform + Instagram/Facebook Messaging API access (requires business verification)
- Razorpay (or Stripe) merchant account
- Cloudflare account (for edge geoblocking + optionally Stream)
- Mux account (if used instead of/alongside Cloudflare Stream)
- SendGrid/Postmark/SES account for transactional email
- Google Cloud project (Calendar API) / Microsoft Graph app (Outlook Calendar)

You (or your dev team) will need to register apps with each of these and generate API keys — I can guide you through each one when we get to that stage.

---

## 6. User Roles & Permissions (Admin Dashboard)

| Role                | Access                                                  |
| ------------------- | ------------------------------------------------------- |
| Owner/Admin         | Full access — bookings, quotes, events, users, settings |
| Booking/Sales Staff | Bookings, calendar, quotations, client inbox            |
| Content Editor      | Portfolio, media, case studies only                     |
| Finance (optional)  | Quotations, payments, invoices only                     |

---

## 7. Security & Compliance Notes

- All client data (contact info, booking history) should sit behind authenticated admin access only — never exposed on public endpoints.
- Payment handling should never touch raw card data directly — use Razorpay/Stripe hosted checkout or SDK to stay out of PCI-DSS scope.
- Geoblocking should be treated as an access-control layer, not a security boundary — it doesn't stop VPNs, so don't rely on it alone for anything sensitive.
- WhatsApp/Meta integrations require compliance with Meta's Business Messaging Policy (opt-in messaging, approved templates for outbound quotes).

---

## 8. Suggested Build Roadmap

**Phase 1 — Foundation**

- Public website (services, portfolio, contact/inquiry forms)
- Basic admin dashboard (auth, client list, manual booking calendar)
- Manual date-blocking flow (Tier 1 from section 3.6)

**Phase 2 — Core Business Logic**

- Quotation engine (build quote → send via email/WhatsApp)
- Ticketed events + Razorpay payments + QR tickets
- Video player integration (portfolio + showreels)

**Phase 3 — Integrations**

- Zoom/Teams/Webex auto-meeting creation for corporate bookings
- Geoblocking at the edge
- Google/Outlook calendar sync

**Phase 4 — Advanced**

- Meta Graph API inbox (Tier 2 semi-automated messaging)
- Livestreaming for ticketed events
- Analytics/reporting dashboard

---

## 9. Next Steps

Once you're happy with this scope, the natural next step is the **clickable UI prototype** — a visual, click-through version of both the public site and the admin dashboard so you can see the booking flow, quotation builder, and event ticketing before any backend work starts.
