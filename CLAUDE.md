# Thunderstream Media — Project Notes for Claude Code

Full-stack production house website (videography, photography,
livestreaming, post production, product shoots, corporate video): a public
site + role-gated admin dashboard sharing one Express/Prisma backend.

## Current state

- `src/pages/Home.jsx` — the public marketing homepage (hero, services,
  portfolio, booking calendar, ticketed events, quote modal). All sections
  are data-driven from the backend (`GET /api/services`, `/api/work`,
  `/api/bookings/availability`, `/api/events`) — no hardcoded mock arrays
  remain. `src/App.jsx` is just the router shell.
- `src/pages/admin/*` — the admin dashboard at `/admin/*`
  (`AdminLogin`/`AdminLayout`/`Overview`/`BookingsCalendar`/`Quotes`/
  `Events`/`CheckIn`/`Clients`/`Content`/`Services`/`Settings`), protected
  by JWT auth (`src/lib/auth.jsx`) and role-gated navigation
  (`src/components/admin/Sidebar.jsx`) matching the roles table in
  `production-house-website-spec.md` §6.
- `server/` — Express + Prisma (SQLite by default) backend. Every module
  in the spec has a real DB model + route: bookings, quotes (with PDF
  generation + line items), events/tickets/QR check-in/Razorpay payments,
  clients (CRM), portfolio (`WorkItem`), geoblocking (`GeoRule`), users.
  Third-party integrations (Zoom/Teams/Webex, WhatsApp Business API,
  SendGrid, Razorpay, Google/Outlook Calendar) live in
  `server/src/integrations/*.js`, one file per provider — each runs in
  mock mode (logs + realistic fake response) unless its `*_ENABLED` env
  var + credentials are set in `server/.env` (see `.env.example`).
  GeoIP blocking (`geoip-lite`) and local-disk media storage (`multer`,
  served at `/media/*`) are real, not mocked — no external account
  needed for either.
- Design system: near-black stage background, stream-red primary accent
  (`T.stream`, brand color), daylight-blue secondary accent, Fraunces
  (display) + Space Grotesk (body) + JetBrains Mono (timecodes/specs).
  Tokens live in the `T` object in `src/shared.jsx` — reuse it (including
  in admin UI) rather than introducing new colors/fonts ad hoc. The site
  has light and dark themes: `T.*` values are CSS variables (`var(--bg)`
  etc.) defined per theme in `src/index.css`, switched via
  `data-theme` on `<html>` (`useTheme()` in `src/lib/theme.jsx`,
  `ThemeToggle` in the navbar/admin sidebar; the initial value is set by
  an inline script in `index.html` to avoid a flash). The
  `Logo` component (also in `shared.jsx`) is the canonical wordmark —
  use it instead of hand-rolling the brand name in new pages.
- `deploy/` — production deployment for a single Ubuntu VPS at
  `thunderstreammedia.com` (Caddy + pm2 + Postgres + Redis): `README.md`
  is the step-by-step guide, `setup-server.sh` / `deploy.sh` / `backup.sh`
  are the scripts; `push-to-server.sh` (run on the laptop) uploads the code and
  deploys it in one step. The site is LIVE (see deployment memory for the server). Production seeding is `npm run prisma:seed:prod` in
  `server/` (owner login + real price-list services only) — never run
  the dev `prisma:seed` there, it creates demo content. In production the
  API refuses to start without a strong `JWT_SECRET`, and CORS is locked
  to `FRONTEND_URL`.
- `production-house-website-spec.md` (repo root) / `docs/architecture-
  spec.md` — the technical spec this build implements. Read it before
  changing integration behavior or adding a new module; it documents the
  intended architecture and the recommended third-party services.

## Working conventions

- Keep the visual language (grain overlay, aperture-wipe hero, red glow
  buttons, timecode-style eyebrows) intact when extending — it's a
  deliberate brand choice, not decoration to strip out. Reuse
  `src/shared.jsx`'s `Grain`/`Aperture`/`Eyebrow`/`useReveal` in new
  public-facing pages.
- Respect `prefers-reduced-motion` for any new animation, matching the
  existing CSS in `FONT_IMPORT` (`src/shared.jsx`).
- **`useReveal()`'s `IntersectionObserver` only queries `.reveal`
  elements once, at mount.** Never put the `.reveal` class on an element
  that's conditionally absent when the page first mounts (e.g. behind an
  async fetch or an early-return loading guard) — it will never be
  observed and stays permanently invisible. Either wrap it in an
  always-mounted `.reveal` parent (see `Home.jsx`'s Events section), or
  skip the class for content that doesn't need scroll-reveal.
- **Never write `const load = () => apiGet(...).then(...)` (expression-
  bodied arrow) and pass it straight to `useEffect(load, [])`** — the
  returned Promise gets treated as the effect's cleanup function and
  crashes with `TypeError: destroy is not a function`. Give `load` a
  block body instead.
- **Theming rules.** Never hardcode `#fff`/`rgba(255,255,255,…)`/
  `text-white`/`hover:bg-white/…` for UI surfaces — they vanish in light
  mode. Use `T.*` tokens, or the helper vars `--wash` / `--wash-strong`
  (subtle fills, e.g. `hover:bg-[var(--wash)]`), `--scrim` (modal
  backdrops) and `--shadow-lg`. Because `T.*` are `var(...)` strings, do
  **not** append hex alpha (`T.stream + '33'`) — use `color-mix(in srgb,
  <color> 20%, transparent)`; and for libraries that need a literal
  color (e.g. Razorpay's `theme.color`) use `BRAND_HEX`. Anything that
  sits on photos/video (portfolio cards, the video player, thumbnails)
  gets the `media-dark` class so it keeps the dark palette in both
  themes. The wordmark ships as two PNGs (`logo.png` white lettering,
  `logo-light-theme.png` dark lettering) swapped by CSS in `<Logo>`.
- New integrations follow the existing gate pattern in
  `server/src/integrations/`: one exported async function per provider,
  checking `process.env.X_ENABLED === 'true' && <credentials present>`
  before branching to a real API call, with a `console.log('[MOCK:...]',
  ...)` + realistic fake response otherwise. Keep the response shape
  identical in both branches so routes/frontend never need to know which
  mode is active.
- Backend enums are plain `String` columns, not Prisma `enum` blocks —
  SQLite's Prisma connector doesn't support native enums. Canonical
  value lists live in `server/src/lib/enums.js`; validate against them
  with zod at the route layer.
- New admin pages: gate their sidebar entry in `Sidebar.jsx` by role
  (matching spec §6) and mirror that with `requireRole(...)` on the
  corresponding backend route — the frontend gate is UX only, the
  backend one is the actual boundary.
