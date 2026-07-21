-- ============================================================================
-- NeuroAbsorption Engine — PostgreSQL / Supabase Schema
-- ----------------------------------------------------------------------------
-- Module 1: RSVP Speed Reading & Metrics       (books, rsvp_sessions,
--                                               comprehension_tests)
-- Module 2: Memory Reconsolidation Studio      (schema_rewrites,
--                                               recall_prompts)
-- Module 3: Absorption & Doctrine Engine       (brain_dumps, doctrine_rules,
--                                               review_schedules, habits,
--                                               habit_logs)
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- ENUMS
-- ----------------------------------------------------------------------------

create type book_status as enum ('uploaded', 'processing', 'ready', 'archived');

create type rewrite_status as enum (
  'friction_logged',      -- Step A complete
  'schema_retrieved',     -- Step B complete
  'evidence_extracted',   -- Step C complete
  'juxtaposed',           -- Steps 1 & 2 complete (prediction error induced)
  'window_open',          -- Step 3: 5-hour reconsolidation window active
  'window_closed',        -- synaptic relocking presumed complete
  'verified',             -- Step V audit passed (effortless permanence)
  'relapsed'              -- verification failed; schedule a re-juxtaposition
);

create type review_outcome as enum ('pending', 'recalled', 'partial', 'failed');

create type habit_day_status as enum ('completed', 'missed', 'excused');

-- ----------------------------------------------------------------------------
-- MODULE 1 — RSVP SPEED READING
-- ----------------------------------------------------------------------------

create table books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null,
  author        text,
  status        book_status not null default 'uploaded',
  storage_path  text,                  -- Supabase Storage path of the raw PDF
  extracted_text text,                 -- full plain-text extraction
  word_count    integer not null default 0 check (word_count >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_books_user on books (user_id, created_at desc);

create table rsvp_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  book_id         uuid not null references books (id) on delete cascade,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  start_word_index integer not null default 0 check (start_word_index >= 0),
  end_word_index   integer check (end_word_index >= start_word_index),
  words_consumed  integer not null default 0 check (words_consumed >= 0),
  active_ms       integer not null default 0 check (active_ms >= 0), -- excludes pauses
  avg_wpm         numeric(6, 1) check (avg_wpm between 0 and 3000),
  peak_wpm        numeric(6, 1) check (peak_wpm between 0 and 3000),
  chunk_size      smallint not null default 1 check (chunk_size between 1 and 3),
  created_at      timestamptz not null default now()
);

create index idx_rsvp_sessions_user on rsvp_sessions (user_id, started_at desc);
create index idx_rsvp_sessions_book on rsvp_sessions (book_id);

create table comprehension_tests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  rsvp_session_id uuid not null references rsvp_sessions (id) on delete cascade,
  questions       jsonb not null default '[]'::jsonb, -- [{q, options[], correctIdx, chosenIdx}]
  score_pct       numeric(5, 2) not null check (score_pct between 0 and 100),
  taken_at        timestamptz not null default now()
);

create index idx_comprehension_session on comprehension_tests (rsvp_session_id);

-- ----------------------------------------------------------------------------
-- MODULE 2 — MEMORY RECONSOLIDATION STUDIO (Ecker et al. Coherence Framework)
-- ----------------------------------------------------------------------------

create table schema_rewrites (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  book_id              uuid references books (id) on delete set null,
  status               rewrite_status not null default 'friction_logged',

  -- Step A: Symptom / Friction Identification
  friction_description text not null,

  -- Step B: Target Schema Retrieval (old implicit belief)
  old_schema           text,
  old_schema_emotional_charge smallint check (old_schema_emotional_charge between 1 and 10),

  -- Step C: Disconfirming Evidence (mined from the PDF)
  disconfirming_evidence text,
  evidence_source_locator text, -- page / chapter / word-index reference

  -- Steps 1 & 2: Juxtaposition
  juxtaposed_at        timestamptz,

  -- Step 3: Reconsolidation Window (T_window <= 5h)
  window_opened_at     timestamptz,
  window_closes_at     timestamptz
    generated always as (window_opened_at + interval '5 hours') stored,
  recall_reps_required smallint not null default 3,
  recall_reps_completed smallint not null default 0
    check (recall_reps_completed >= 0),

  -- Step V: Verification Audit
  verified_at          timestamptz,
  verification_notes   text,
  permanence_score     smallint check (permanence_score between 1 and 10),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint reps_within_required check (recall_reps_completed <= recall_reps_required)
);

create index idx_rewrites_user_status on schema_rewrites (user_id, status);
create index idx_rewrites_open_windows on schema_rewrites (window_closes_at)
  where status = 'window_open';

create table recall_prompts (
  id                uuid primary key default gen_random_uuid(),
  schema_rewrite_id uuid not null references schema_rewrites (id) on delete cascade,
  ordinal           smallint not null check (ordinal between 1 and 3),
  scheduled_at      timestamptz not null,
  completed_at      timestamptz,
  duration_seconds  smallint not null default 30,
  unique (schema_rewrite_id, ordinal)
);

create index idx_recall_prompts_due on recall_prompts (scheduled_at)
  where completed_at is null;

-- ----------------------------------------------------------------------------
-- MODULE 3 — ABSORPTION & DOCTRINE ENGINE
-- ----------------------------------------------------------------------------

create table brain_dumps (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  book_id         uuid not null references books (id) on delete cascade,
  markdown_body   text not null default '',
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  duration_seconds integer not null default 600, -- 10-minute lockout window
  word_count      integer not null default 0 check (word_count >= 0)
);

create index idx_brain_dumps_book on brain_dumps (book_id, started_at desc);

create table doctrine_rules (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  book_id           uuid references books (id) on delete set null,
  brain_dump_id     uuid references brain_dumps (id) on delete set null,

  -- The registry sorts by context_cue, NEVER by book. Enforced by index below.
  context_cue       text not null,        -- "Morning Coffee", "Before Opening Email"
  behavior_command  text not null,        -- imperative: "Write the top-3 list first"

  -- Elaborative Interrogation
  why_true          text not null default '',  -- "Why is this true?"
  arguing_pair_clash text not null default '', -- steelman of the opposing view + rebuttal

  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Primary access path: registry grouped by trigger cue.
create index idx_doctrine_by_cue on doctrine_rules (user_id, context_cue, created_at);
create index idx_doctrine_active on doctrine_rules (user_id) where is_active;

create table review_schedules (
  id               uuid primary key default gen_random_uuid(),
  doctrine_rule_id uuid not null references doctrine_rules (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  stage            smallint not null default 0 check (stage between 0 and 4),
  -- stage -> interval: 0=1d, 1=3d, 2=7d, 3=14d, 4=30d (repeats at 30d)
  next_review_at   timestamptz not null,
  last_outcome     review_outcome not null default 'pending',
  last_reviewed_at timestamptz,
  total_reviews    integer not null default 0 check (total_reviews >= 0),
  total_lapses     integer not null default 0 check (total_lapses >= 0),
  unique (doctrine_rule_id)
);

create index idx_reviews_due on review_schedules (user_id, next_review_at);

create table habits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  doctrine_rule_id uuid not null references doctrine_rules (id) on delete cascade,
  started_on       date not null default current_date,
  horizon_days     smallint not null default 66,
  completed_at     timestamptz,
  abandoned_at     timestamptz,
  unique (doctrine_rule_id)
);

create index idx_habits_user_active on habits (user_id)
  where completed_at is null and abandoned_at is null;

create table habit_logs (
  id        uuid primary key default gen_random_uuid(),
  habit_id  uuid not null references habits (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  log_date  date not null,
  status    habit_day_status not null,
  note      text,
  unique (habit_id, log_date)
);

create index idx_habit_logs_habit on habit_logs (habit_id, log_date);

-- ----------------------------------------------------------------------------
-- updated_at bookkeeping
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_books_updated          before update on books
  for each row execute function set_updated_at();
create trigger trg_rewrites_updated       before update on schema_rewrites
  for each row execute function set_updated_at();
create trigger trg_doctrine_updated       before update on doctrine_rules
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security (Supabase)
-- ----------------------------------------------------------------------------

alter table books               enable row level security;
alter table rsvp_sessions       enable row level security;
alter table comprehension_tests enable row level security;
alter table schema_rewrites     enable row level security;
alter table recall_prompts      enable row level security;
alter table brain_dumps         enable row level security;
alter table doctrine_rules      enable row level security;
alter table review_schedules    enable row level security;
alter table habits              enable row level security;
alter table habit_logs          enable row level security;

create policy "own books"        on books
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rsvp"         on rsvp_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tests"        on comprehension_tests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rewrites"     on schema_rewrites
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own prompts"      on recall_prompts
  for all using (exists (
    select 1 from schema_rewrites sr
    where sr.id = recall_prompts.schema_rewrite_id and sr.user_id = auth.uid()
  ));
create policy "own dumps"        on brain_dumps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own doctrine"     on doctrine_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own schedules"    on review_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own habits"       on habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own habit logs"   on habit_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
