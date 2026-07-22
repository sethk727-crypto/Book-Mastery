-- ============================================================================
-- Migration 002 — run this ONCE in the Supabase SQL editor if you already
-- applied schema.sql before this migration existed. (Fresh installs get all
-- of this from the updated schema.sql and do NOT need to run this file.)
--
-- Adds: reading-position resume columns on books, and the
-- push_subscriptions table for browser push reminders.
-- ============================================================================

alter table books add column if not exists last_page_index integer not null default 0;
alter table books add column if not exists last_word_index integer not null default 0;

create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subs_user on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "own push subscriptions" on push_subscriptions;
create policy "own push subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
