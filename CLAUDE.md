# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Next.js + Turbopack) at localhost:3000
npm run build        # Production build
npm test             # Run all tests (Vitest, non-watch)
npm run test:watch   # Run tests in watch mode
npm run lint         # ESLint via Next.js
```

Run a single test file:
```bash
npx vitest run tests/unit/domain/SplitCalculatorService.test.ts
```

**Required env:** `GROQ_API_KEY` in `.env.local` for the OCR endpoint to function.

## Architecture

Clean Architecture with strict one-way dependency flow:

```
domain ← application ← infrastructure
                      ← presentation (calls API routes, not use cases directly)
```

`composition-root/container.ts` is the **only** file that imports from both `application/` and `infrastructure/`. All use cases are instantiated there and exported as `container`. API route handlers import from `container` — never directly from infrastructure.

### Layer responsibilities

**`domain/`** — Pure TypeScript types and functions, zero dependencies.
- Entities are plain readonly types (`Bill`, `BillItem`, `Participant`, `Assignment`, `SplitResult`).
- `BillItem.splitConfig` is the central split model: `null` means legacy per-unit assignment (via `Bill.assignments[]`); a non-null `ItemSplitConfig` with a `SplitMode` and `entries[]` handles all other modes.
- `SplitCalculatorService.ts` exports a single pure function `calculateSplit(bill)` — the core business logic.
- `Money` is a value object `{ amount: number, currency: string }` — use the helper functions (`createMoney`, `addMoney`, `multiplyMoney`, etc.), never construct it raw.
- IDs are branded types (`BillId`, `ParticipantId`, `BillItemId`) — use the factories in `BrandedIds.ts`.

**`application/`** — Use cases and port interfaces.
- Each use case is a class with a single `execute(dto)` method.
- Port interfaces in `application/ports/` define what the application needs from the outside world (`IBillRepository`, `IOcrService`, `IReceiptExtractorService`, `IEventBus`).
- DTOs and mappers in `application/dtos/` convert between domain entities and API-safe objects.

**`infrastructure/`** — Concrete implementations of ports.
- `SupabaseBillRepository` — active repository; reads/writes to Supabase PostgreSQL. Uses upsert + delete-orphans pattern in `save()` to be safe under concurrent requests. Calls `createClient()` (server) inside each method so it reads the request cookies per-call — no factory pattern needed.
- `InMemoryBillRepository` — kept for reference/tests; no longer wired in the container.
- `GroqReceiptService` — primary OCR: sends images to `llama-4-scout-17b-16e-instruct` and PDFs (text extracted first) to `llama-3.3-70b-versatile`.
- Swapping implementations means adding a new file in `infrastructure/` and changing one line in `composition-root/container.ts`.

**`presentation/`** — React components and Zustand stores.
- Two stores: `billStore` (all bill state) and `uiStore` (toasts, modals).
- Components call the Next.js API routes via fetch, not use cases directly.
- Path alias `@/*` maps to the repo root.

**`app/`** — Next.js App Router pages and API route handlers.
- Pages: `/` (home), `/bills/new`, `/bills/[billId]`, `/bills/[billId]/summary`.
- API routes import from `container` and delegate entirely to use cases.

## Split Modes

`BillItem.splitConfig.mode` drives calculation in `calculateSplit()`:
- `null` splitConfig → per-unit via `Bill.assignments[]` (legacy mode, "Per Unit" in UI)
- `"equally"` → total price ÷ number of entries
- `"by_count"` → entry.value / sum(all values) × total
- `"by_percentage"` → entry.value / 100 × total
- `"by_shares"` → entry.value / sum(all values) × total
- `"by_amount"` → entry.value directly

Tax and tip are distributed proportionally based on each participant's subtotal share of the bill subtotal.

## Testing

Tests live in `tests/unit/`. Currently only `SplitCalculatorService` has tests. The vitest config uses `jsdom` environment with `@testing-library/jest-dom` matchers loaded via `tests/setup.ts`. Globals are enabled (`describe`, `it`, `expect` without imports).

## Auth

Supabase Auth handles sessions via `@supabase/ssr`. Two clients:
- `lib/supabase/client.ts` — browser client (`createBrowserClient`), used in Client Components and auth forms.
- `lib/supabase/server.ts` — async server client (`createServerClient` + `cookies()`), used in API routes and the repository.

`middleware.ts` protects all page routes (excludes `/api/`, `/_next/`, `/login`, `/signup`, `/auth/callback`). Unauthenticated page requests redirect to `/login`; authenticated users visiting auth pages redirect to `/`.

Supported auth methods: email/password and Google OAuth. OAuth callback is handled by `app/auth/callback/route.ts` which exchanges the code for a session via `supabase.auth.exchangeCodeForSession(code)`.

To create a pre-confirmed test user (no email confirmation required):
```bash
# Add SUPABASE_SERVICE_ROLE_KEY to .env.local first
node scripts/create-test-user.mjs                          # test@aisplit.dev / testpass123
node scripts/create-test-user.mjs email@example.com pass  # custom credentials
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=       # Service role key (only for scripts, never exposed to browser)
GROQ_API_KEY=                    # Groq API key for OCR
```

## Project Roadmap

### ✅ Iteration 1 — Core Bill Splitting
- Clean Architecture (domain → application → infrastructure → presentation)
- OCR receipt parsing: images via Llama 4 Scout Vision, PDFs via Llama 3.3 70B (Groq)
- 5 split modes: equally, by count, by percentage, by shares, by amount + per-unit assignment
- Full bill flow: items → participants → assign → summary
- Copy summary to clipboard (plain text for WhatsApp/iMessage)
- In-memory storage, Zustand state management, 6 passing unit tests

### ✅ Iteration 2 — Auth + Persistence
- Supabase PostgreSQL with Row Level Security (per-user data isolation)
- Email/password authentication (login, signup, email confirmation handling)
- Bill history dashboard with status badges (Draft / Assigned), View Summary, Edit/Continue
- Bill status auto-updates to "assigned" when split is complete
- Inline participant rename (click name to edit in place)
- Batch add items endpoint — OCR confirmation does one save instead of N serial saves
- Fixed duplicate key race condition in `save()` — upsert + delete-orphans pattern
- Test user creation script using Supabase Admin API

### ✅ Iteration 3 — Friends + Google OAuth + Debt Summary
- **Google OAuth** — "Sign in with Google" button on login/signup pages; callback at `app/auth/callback/route.ts`
- `profiles` table auto-populated on signup via Postgres trigger; stores `display_name` + `avatar_url`
- Friend system: send request by email → accept → friends list; DB tables `friend_requests` + `friendships` (canonical ordering `user_a < user_b`); atomic accept via `accept_friend_request(request_id)` SECURITY DEFINER function
- `Participant.userId` field links participants to registered users; propagated through domain, DTOs, mappers, repository
- Participant picker: "Friends" dropdown in the add-participant form — adds friend as linked participant
- **Debt summary**: `/friends` page shows net balance per friend, aggregated across shared bills; expandable per-bill breakdown
- Friend request API: `GET/POST /api/friends`, `GET /api/friends/requests`, `PATCH /api/friends/requests/[id]`, `GET /api/friends/[friendId]/debt`
- Bills RLS updated to allow participant-linked users to see shared bills

### 🔜 Iteration 4 — Settle Up + Email Notifications
- **Settle up**: enter a specific amount or settle full balance with any friend; creates a settlement record that offsets the running debt
- Settlement history log per friendship
- Payment deep-links alongside settle (PayPal / Venmo / UPI URL schemes — no Stripe yet)
- **Email notifications** via Resend: triggered on bill creation, split update, and settlement
  - Each participant gets their individual share shown prominently + full bill summary below
- Optional Slack / WhatsApp webhook for power users

### 🔜 Iteration 5 — Analytics + AI Intelligence
- Analytics dashboard: spending per friend, per category, monthly trends
- **Smart AI suggestions**: when uploading a bill, suggest participant splits based on past patterns with the same group
- Bill templates: save a recurring group (roommates, team lunch) with preset participants and split mode
- Multi-language OCR: auto-detect receipt language for international trips
- Currency conversion with live exchange rates

### 🔜 Iteration 6 — Production + Polish
- Vercel deployment with environment management
- PWA: installable, offline viewing of recent bills via service worker cache
- Dark mode refinements + accessibility audit (WCAG AA)
- End-to-end tests: Cypress or Playwright covering create bill → OCR → assign → settle flows
- Error monitoring (Sentry) + performance budget
