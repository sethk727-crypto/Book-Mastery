-- ============================================================================
-- Supabase Storage — private "books" bucket for uploaded PDFs.
-- Files live under <user_id>/<uuid>.pdf; each user can only touch their
-- own folder. The extraction API route reads via the service role.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy "users upload to own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'books'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users read own folder"
  on storage.objects for select
  using (
    bucket_id = 'books'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "users delete own folder"
  on storage.objects for delete
  using (
    bucket_id = 'books'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
