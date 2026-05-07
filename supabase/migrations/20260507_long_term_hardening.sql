do $$
begin
  if exists (
    select 1
    from public.images image
    join public.folders folder on folder.id = image.folder_id
    where image.folder_id is not null
      and image.user_id <> folder.user_id
  ) then
    raise exception 'Cannot add images_folder_user_fk: cross-user folder references exist.';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.folders'::regclass
      and conname = 'folders_user_id_id_key'
  ) then
    alter table public.folders
      add constraint folders_user_id_id_key unique (user_id, id);
  end if;
end;
$$;

alter table public.images
  drop constraint if exists images_folder_id_fkey;

alter table public.images
  drop constraint if exists images_folder_user_fk;

alter table public.images
  add constraint images_folder_user_fk
  foreign key (user_id, folder_id)
  references public.folders(user_id, id)
  on delete set null (folder_id);

create unique index if not exists images_thumbnail_path_unique_idx
on public.images (thumbnail_path)
where thumbnail_path is not null;

create unique index if not exists images_display_path_unique_idx
on public.images (display_path)
where display_path is not null;

create unique index if not exists images_original_path_unique_idx
on public.images (original_path)
where original_path is not null;

drop policy if exists "gallery_images_select_own" on storage.objects;
create policy "gallery_images_select_own"
on storage.objects
for select
using (
  bucket_id = 'gallery-images'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or (
      (storage.foldername(name))[1] in ('thumbnails', 'display', 'originals')
      and auth.uid()::text = (storage.foldername(name))[2]
    )
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
    or (
      (storage.foldername(name))[1] in ('thumbnails', 'display', 'originals')
      and auth.uid()::text = (storage.foldername(name))[2]
    )
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
    or (
      (storage.foldername(name))[1] in ('thumbnails', 'display', 'originals')
      and auth.uid()::text = (storage.foldername(name))[2]
    )
  )
)
with check (
  bucket_id = 'gallery-images'
  and (
    auth.uid()::text = (storage.foldername(name))[1]
    or (
      (storage.foldername(name))[1] in ('thumbnails', 'display', 'originals')
      and auth.uid()::text = (storage.foldername(name))[2]
    )
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
    or (
      (storage.foldername(name))[1] in ('thumbnails', 'display', 'originals')
      and auth.uid()::text = (storage.foldername(name))[2]
    )
  )
);
