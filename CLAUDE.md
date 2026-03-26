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
- `InMemoryBillRepository` — no database; all data lives in process memory and resets on restart.
- `GroqReceiptService` — primary OCR: sends images to `llama-4-scout-17b-16e-instruct` and PDFs (text extracted first) to `llama-3.3-70b-versatile`.
- Swapping implementations (e.g., adding a database) means adding a new file in `infrastructure/` and changing one line in `composition-root/container.ts`.

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
