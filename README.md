# NeuroAbsorption Engine

Turn uploaded books into rapid mental-model updates and behavioral execution.

Three interconnected modules:

1. **RSVP Speed Reading & Metrics** — Rapid Serial Visual Presentation with
   Optimal Recognition Point (ORP) highlighting, 200–1200 WPM with dynamic
   punctuation delays, and a metrics engine (WPM history, active reading time,
   words consumed, comprehension scores).
2. **Memory Reconsolidation Studio** — Ecker et al. Coherence Framework:
   friction identification → target schema retrieval → disconfirming evidence →
   juxtaposition (Old Model vs. Disconfirming Reality) → 5-hour reconsolidation
   window with 3 mandatory 30-second recall reps → verification audit.
3. **Absorption & Doctrine Engine** — timed free-recall brain dumps,
   `If [Context Cue] → Then [Behavior Command]` rule extraction with elaborative
   interrogation, a trigger-sorted doctrine registry, expanding-interval spaced
   repetition (1/3/7/14/30 days) with masked flashcards, and a 66-day habit
   horizon ring with single-miss tolerance.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Framer Motion (RSVP animation), Lucide icons
- Supabase (PostgreSQL + Auth + Storage) — schema in `supabase/schema.sql`

## Getting started

```bash
npm install
cp .env.example .env.local   # add your Supabase URL + anon key
npm run dev
```

Apply the database schema in the Supabase SQL editor (or via CLI):

```bash
supabase db push   # or paste supabase/schema.sql into the SQL editor
```

The root page (`app/page.tsx`) currently runs on in-memory sample data so all
three modules are demoable without a database.

## Layout

```
app/                    App Router shell + demo dashboard
components/
  RSVPReader.tsx        Module 1 — RSVP engine UI
  ReconsolidationStudio.tsx  Module 2 — juxtaposition modal + 5h window
  DoctrineQueue.tsx     Module 3 — registry, masked recall, habit ring
hooks/
  useRSVPReader.ts      rAF display loop, ORP, WPM math, metrics
  useReconsolidationTimer.ts  5h window, 3×30s reps, notifications
  useSpacedRepetition.ts      expanding-interval queue + grading
lib/
  rsvp.ts               tokenizer, ORP index, punctuation delays
  spacedRepetition.ts   interval math (1/3/7/14/30 d)
  habits.ts             66-day progress + single-miss tolerance
  types.ts              domain types mirroring the SQL schema
supabase/schema.sql     full PostgreSQL schema with RLS
```
