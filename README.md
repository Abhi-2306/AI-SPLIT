# AI Split

A smart bill-splitting web app with AI-powered receipt scanning, friend debt tracking, and settle-up flows — built as a Splitwise alternative with per-item split control and OCR built in.

Live: [your-app.vercel.app](https://your-app.vercel.app)

---

## Features

### Receipt Scanning
- Upload a photo or PDF of any receipt
- Groq (Llama 4 Scout Vision) extracts all items, prices, tax, and tip automatically
- Review and edit before confirming — OCR results are never applied blindly

### AI Smart Split
- After scanning, an AI agent analyses each item and suggests who should pay for what
- Suggestions can be applied fully or partially per item
- Rate limited to 3 uses/day (separate from OCR limit)

### Split Modes
Each item can be split independently using any of 5 modes:

| Mode | How it works |
|------|-------------|
| Per Unit | Assign individual units to specific people |
| Equally | Split evenly among selected participants |
| By Count | Each person claims how many they had |
| By % | Custom percentage per person |
| By Shares | Weighted share allocation |
| By Amount | Exact amount per person |

Tax and tip are detected from the receipt and distributed proportionally.

### Friends & Debt Tracking
- Add friends by email, accept requests
- View net balance per friend across all shared bills
- Per-bill breakdown of who owes what

### Settle Up
- Record payments between friends
- Payment history with timestamps
- Delete settlements with balance recalculation
- Email notification sent to the recipient automatically

### Email Notifications
- Settlement recorded → recipient notified
- Friend request accepted → requester notified
- "Notify Participants" on summary → each linked participant gets their personal item breakdown

### Analytics
- Monthly spending bar chart (last 6 months)
- Top friends by shared bills
- Summary stats: this month, total bills, friends, total settled
- Currency conversion using live exchange rates (30+ currencies)

### Bill Templates
- Save a participant group as a template (e.g. "Roommates", "Lunch Crew")
- Load template when creating a new bill to skip re-adding people

### Groups
- Create named groups with members
- Bulk-add all group members to a bill in one click

### PWA
- Installable on mobile and desktop ("Add to Home Screen")
- Offline viewing of recently visited bills via service worker cache

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth — email/password + Google OAuth |
| AI / OCR | Groq — Llama 4 Scout Vision (images), Llama 3.3 70B (PDFs) |
| Email | Nodemailer (Gmail SMTP) |
| State | Zustand |
| Charts | Recharts |
| PWA | @ducanh2912/next-pwa (Workbox) |
| Unit Tests | Vitest + Testing Library |
| E2E Tests | Playwright |
| Error Monitoring | Sentry |
| Deployment | Vercel |

---

## Architecture

Clean Architecture with strict one-way dependency flow:

```
domain → application → infrastructure
                     → presentation (calls API routes via fetch)
```

- **`domain/`** — Pure TypeScript types and functions, zero external dependencies
- **`application/`** — Use cases (each with a single `execute()` method) and port interfaces
- **`infrastructure/`** — Supabase repository, Groq OCR service, email service
- **`presentation/`** — React components and Zustand stores
- **`composition-root/container.ts`** — Only file that wires application ↔ infrastructure
- **`app/`** — Next.js pages and API route handlers (import from `container`, not infrastructure directly)

---

## Getting Started

### Prerequisites

- Node.js 18+
- [Supabase](https://supabase.com) project (free tier works)
- [Groq API key](https://console.groq.com) (free)
- Gmail account with an [App Password](https://support.google.com/accounts/answer/185833) enabled

### Installation

```bash
git clone https://github.com/Abhi-2306/AI-SPLIT.git
cd AI-SPLIT
npm install
```

### Environment Variables

Create `.env.local` in the project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Groq (OCR + AI suggestions)
GROQ_API_KEY=

# Email (Gmail SMTP)
GMAIL_USER=
GMAIL_APP_PASSWORD=

# Public URL (used in email links)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Sentry (optional — error monitoring)
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

### Run

```bash
npm run dev        # Dev server at localhost:3000
```

### Create a test user (skips email confirmation)

```bash
# Add SUPABASE_SERVICE_ROLE_KEY to .env.local first
node scripts/create-test-user.mjs                           # test@aisplit.dev / testpass123
node scripts/create-test-user.mjs email@example.com pass   # custom credentials
```

---

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build (Webpack — required for PWA)
npm run start        # Start production server
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run test:watch   # Vitest in watch mode
npm run e2e          # Playwright E2E tests
npm run e2e:ui       # Playwright with interactive UI
npm run e2e:report   # Open last test report
```

### Running E2E tests

Install browser binaries once:

```bash
npx playwright install chromium
```

Run against localhost (auto-starts dev server):
```bash
npm run e2e
```

Run against deployed app:
```bash
BASE_URL=https://your-app.vercel.app npm run e2e
```

---

## Rate Limits

| Feature | Limit |
|---------|-------|
| OCR scanning | 5 uses / day / user |
| AI suggestions | 3 uses / day / user |

---

## Project Structure

```
├── app/                    # Next.js App Router pages and API routes
├── domain/                 # Entities, value objects, domain services
├── application/            # Use cases, DTOs, port interfaces
├── infrastructure/         # Supabase repository, Groq OCR, email service
├── presentation/           # React components, Zustand stores
├── composition-root/       # Dependency injection container
├── lib/                    # Shared utilities (currency, email, supabase clients)
├── e2e/                    # Playwright end-to-end tests
├── tests/                  # Vitest unit tests
└── scripts/                # Dev utility scripts
```
