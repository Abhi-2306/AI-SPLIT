# AI Split

A smart bill-splitting app that scans receipts with AI and lets you divide costs fairly — just like Splitwise, but with receipt OCR built in.

## Features

- **AI Receipt Scanning** — Upload a photo or PDF of any receipt. Groq (Llama 4 Scout vision) extracts all items, prices, tax, and tip automatically.
- **Multiple Split Modes** — For each item, choose how to split it:
  - **Per Unit** — Assign individual units to specific people (e.g. Alice gets unit 1, Bob gets unit 2)
  - **Equally** — Split among selected participants
  - **By Count** — Each person claims how many they had (great for "35-count" packs)
  - **By %** — Custom percentages per person
  - **By Shares** — Weighted share allocation
  - **By Amount** — Exact rupee/dollar amounts per person
- **Tax & Tip Distribution** — Auto-detected from receipt; distributed proportionally across everyone's share
- **Paid By Tracking** — Mark who paid the bill; the summary shows exactly who owes whom and how much
- **Settlement Summary** — Clean breakdown per person with a "Bob owes Alice ₹X" settlements view

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | Tailwind CSS v4 |
| State | Zustand v5 |
| Validation | Zod v4 |
| AI / OCR | Groq API — `llama-4-scout-17b-16e-instruct` (images), `llama-3.3-70b-versatile` (PDF text) |
| PDF Parsing | pdfjs-dist (legacy build) |
| Architecture | Clean Architecture (Domain → Application → Infrastructure → Presentation) |
| Testing | Vitest |

## Getting Started

### Prerequisites

- Node.js 18+
- A free [Groq API key](https://console.groq.com)

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/ai-split.git
cd ai-split
npm install
```

### Environment Setup

Create a `.env.local` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Tests

```bash
npm test
```

## How It Works

1. **Items** — Upload a receipt or add items manually. Tax and tip are editable in the totals bar.
2. **People** — Add everyone splitting the bill. Set who paid.
3. **Assign** — Choose a split mode for each item and assign accordingly.
4. **Summary** — See each person's total and the settlement list (who pays whom).

## Project Structure

```
├── app/                    # Next.js App Router pages & API routes
├── domain/                 # Entities, value objects, domain services
├── application/            # Use cases, DTOs, port interfaces
├── infrastructure/         # Groq OCR service, in-memory repository
├── presentation/           # React components, Zustand stores
├── composition-root/       # Dependency injection container
└── tests/                  # Vitest unit tests
```

## Notes

- Data is stored **in-memory** — bills reset on server restart. Persistence (database) is a planned future feature.
- The Groq free tier is sufficient for personal use.
