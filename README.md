# Thunderstream Media

Full-stack production house website (videography, photography,
livestreaming, post production, product shoots, corporate video):
a public marketing site + booking/quotation/ticketing flow, and an
admin dashboard, sharing one Express/Prisma backend.

## What's here

- **Public site** — home, services, portfolio (with a custom video
  player), booking calendar, ticketed events with QR tickets and
  Razorpay checkout, quote request form.
- **Admin dashboard** (`/admin`) — role-gated: bookings & calendar
  (incl. manual date-blocking), quotation builder (line items → PDF →
  email/WhatsApp), events & ticketing (incl. a camera QR check-in
  scanner), CRM, portfolio content management, services/pricing rate
  table, and settings (users, integration status, geoblocking rules).
- **Integrations** — Zoom/Teams/Webex meeting auto-creation, WhatsApp
  Business API, SendGrid email, Razorpay payments, and Google/Outlook
  calendar sync all run in **mock mode** by default (the full flow
  works end-to-end with realistic fake responses) and switch to live
  calls the moment their credentials are set in `server/.env` — see
  `server/.env.example` for the full list. GeoIP blocking and local
  media storage are real, not mocked, and need no external account.

## Getting started

### Frontend

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173` (Vite will pick another port if that's
taken).

### Backend

```bash
cd server
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate   # applies migrations to a local SQLite DB
npm run prisma:seed      # seeds services, portfolio, a sample event, and an owner login
npm run dev
```

Runs on `http://localhost:4000`. The seed script prints the owner
login it creates — sign in at `/admin/login` with that email/password.

Backend defaults to SQLite (`server/prisma/dev.db`, zero setup). A
`docker-compose.yml` at the repo root provisions Postgres + Adminer if
you'd rather run against that — see the comment in
`server/.env.example` for the steps to switch.

## Build for production

```bash
npm run build
npm run preview
```

## Project structure

```
aperture-house/
├── src/
│   ├── App.jsx              # router shell
│   ├── pages/                # Home, EventDetail, AdminLogin, admin/*
│   ├── components/           # Navbar, Work, Services, VideoPlayer, admin/*
│   ├── lib/                  # api.js (fetch wrapper), auth.jsx (auth context)
│   └── shared.jsx            # design tokens (T), fonts, reusable primitives
├── server/
│   ├── prisma/                # schema.prisma, migrations, seed.js
│   └── src/
│       ├── routes/            # public + admin/* route handlers
│       ├── integrations/      # one file per third-party provider (mock/live gate)
│       ├── middleware/        # auth.js, geoblock.js
│       └── lib/                # enums.js, pdfGenerator.js
├── docs/
│   └── architecture-spec.md   # original technical spec this build implements
├── production-house-website-spec.md  # same spec, root copy
├── CLAUDE.md                  # notes for Claude Code on project state & conventions
└── index.html
```

## Using this with Claude Code

Open this folder in Claude Code and it will read `CLAUDE.md` automatically
for context on project state and the design system. `docs/architecture-
spec.md` / `production-house-website-spec.md` has the full plan this build
implements — every module in it has a real UI + DB model + route, with
third-party calls gated behind env vars as described above.
