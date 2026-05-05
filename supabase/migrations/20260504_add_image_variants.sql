alter table public.images
  add column if not exists thumbnail_path text null,
  add column if not exists display_path text null,
  add column if not exists original_path text null;

create index if not exists images_user_missing_derivatives_idx
on public.images (user_id, created_at desc)
where thumbnail_path is null or display_path is null;

drop policy if exists "gallery_images_select_own" on storage.objects;
create policy "gallery_images_select_own"
on storage.objects
for select
using (
  bucket_id = 'gallery-images'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = (storage.foldername(name))[2]
  )
);

drop policy if exists "gallery_images_insert_own" on storage.objects;
create policy "gallery_images_insert_own"
on storage.objects
for insert
with check (
  bucket_id = 'gallery-images'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = (storage.foldername(name))[2]
  )
);

drop policy if exists "gallery_images_update_own" on storage.objects;
create policy "gallery_images_update_own"
on storage.objects
for update
using (
  bucket_id = 'gallery-images'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = (storage.foldername(name))[2]
  )
)
with check (
  bucket_id = 'gallery-images'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = (storage.foldername(name))[2]
  )
);

drop policy if exists "gallery_images_delete_own" on storage.objects;
create policy "gallery_images_delete_own"
on storage.objects
for delete
using (
  bucket_id = 'gallery-images'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or auth.uid()::text = (storage.foldername(name))[2]
  )
);
