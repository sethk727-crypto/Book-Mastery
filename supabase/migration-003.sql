-- ============================================================================
-- Migration 003 — run ONCE in the Supabase SQL editor.
-- Public "motivation" storage bucket for vision-board images (supercars,
-- houses, goals). Users upload/delete inside their own folder; images are
-- publicly readable so they can render as backgrounds.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'motivation', 'motivation', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "motivation upload own" on storage.objects;
create policy "motivation upload own"
  on storage.objects for insert
  with check (
    bucket_id = 'motivation'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "motivation delete own" on storage.objects;
create policy "motivation delete own"
  on storage.objects for delete
  using (
    bucket_id = 'motivation'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "motivation public read" on storage.objects;
create policy "motivation public read"
  on storage.objects for select
  using (bucket_id = 'motivation');
