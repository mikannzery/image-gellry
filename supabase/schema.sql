create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name varchar(100) not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint folders_name_not_blank check (char_length(trim(name)) > 0),
  constraint folders_name_length check (char_length(name) <= 100),
  constraint folders_user_name_key unique (user_id, name)
);

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  folder_id uuid null references public.folders(id) on delete set null,
  file_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null,
  width integer not null,
  height integer not null,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint images_file_name_not_blank check (char_length(trim(file_name)) > 0),
  constraint images_size_non_negative check (size_bytes >= 0),
  constraint images_width_positive check (width > 0),
  constraint images_height_positive check (height > 0)
);

create index if not exists folders_user_last_used_idx on public.folders (user_id, last_used_at desc);
create index if not exists images_user_created_idx on public.images (user_id, created_at desc);
create index if not exists images_user_folder_created_idx on public.images (user_id, folder_id, created_at desc);
create index if not exists images_user_favorite_created_idx on public.images (user_id, is_favorite, created_at desc);

drop trigger if exists set_folders_updated_at on public.folders;
create trigger set_folders_updated_at
before update on public.folders
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_images_updated_at on public.images;
create trigger set_images_updated_at
before update on public.images
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.folders enable row level security;
alter table public.images enable row level security;

drop policy if exists "folders_select_own" on public.folders;
create policy "folders_select_own"
on public.folders
for select
using (auth.uid() = user_id);

drop policy if exists "folders_insert_own" on public.folders;
create policy "folders_insert_own"
on public.folders
for insert
with check (auth.uid() = user_id);

drop policy if exists "folders_update_own" on public.folders;
create policy "folders_update_own"
on public.folders
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "folders_delete_own" on public.folders;
create policy "folders_delete_own"
on public.folders
for delete
using (auth.uid() = user_id);

drop policy if exists "images_select_own" on public.images;
create policy "images_select_own"
on public.images
for select
using (auth.uid() = user_id);

drop policy if exists "images_insert_own" on public.images;
create policy "images_insert_own"
on public.images
for insert
with check (auth.uid() = user_id);

drop policy if exists "images_update_own" on public.images;
create policy "images_update_own"
on public.images
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "images_delete_own" on public.images;
create policy "images_delete_own"
on public.images
for delete
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('gallery-images', 'gallery-images', false)
on conflict (id) do nothing;

drop policy if exists "gallery_images_select_own" on storage.objects;
create policy "gallery_images_select_own"
on storage.objects
for select
using (
  bucket_id = 'gallery-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "gallery_images_insert_own" on storage.objects;
create policy "gallery_images_insert_own"
on storage.objects
for insert
with check (
  bucket_id = 'gallery-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "gallery_images_update_own" on storage.objects;
create policy "gallery_images_update_own"
on storage.objects
for update
using (
  bucket_id = 'gallery-images'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'gallery-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "gallery_images_delete_own" on storage.objects;
create policy "gallery_images_delete_own"
on storage.objects
for delete
using (
  bucket_id = 'gallery-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
