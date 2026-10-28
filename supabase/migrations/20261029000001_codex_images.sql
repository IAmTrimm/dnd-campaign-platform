-- B015: one main image (portrait or cover) per Codex article.
--
-- Images live in a PRIVATE Storage bucket, "codex-images", at
--   <article id>/<random file name>
-- There are no public URLs. Who can read or change a file is decided by the
-- article in its path, using the same rules as the article itself:
--   read           anyone who can read the article (so drafts, DM secrets and
--                  other campaigns' articles stay hidden; discoveries count)
--   upload/delete  whoever can edit the article (its campaign's DM, the Owner)
-- Files can't be overwritten in place: replacing an image uploads a new file,
-- points the article at it, then deletes the old one.

------------------------------------------------------------------------------
-- Article columns
------------------------------------------------------------------------------

alter table public.codex_entries
  add column image_path text,   -- file in the codex-images bucket, or empty
  add column image_alt  text,   -- description for screen readers
  -- An article can only show an image stored in its own folder.
  add constraint codex_entries_image_path_check
    check (image_path is null or image_path ~ ('^' || id::text || '/[A-Za-z0-9_-]+\.(jpg|png|webp)$')),
  add constraint codex_entries_image_alt_check
    check (image_alt is null or length(image_alt) <= 300);

-- Editors set the image through the existing "Editors change Codex entries" policy.
grant update (image_path, image_alt) on public.codex_entries to authenticated;

------------------------------------------------------------------------------
-- The bucket: private, images only, 5 MB per file
------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('codex-images', 'codex-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

------------------------------------------------------------------------------
-- Helper checks (private schema, not exposed through the API)
------------------------------------------------------------------------------

-- The article a file belongs to, or null if the path isn't "<uuid>/<file>".
create function private.codex_image_entry(object_name text)
returns uuid language sql immutable set search_path = ''
as $$
  select case
    when object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
    then split_part(object_name, '/', 1)::uuid
  end;
$$;

-- Can the current user edit this article?
create function private.can_edit_codex_entry(target_entry uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select private.can_edit_codex(e.world_id, e.campaign_id)
    from public.codex_entries e where e.id = target_entry
  ), false);
$$;

revoke execute on function private.codex_image_entry(text), private.can_edit_codex_entry(uuid) from public;
grant execute on function private.codex_image_entry(text), private.can_edit_codex_entry(uuid) to authenticated;

------------------------------------------------------------------------------
-- Storage policies (signed-out visitors get nothing: no anon policies)
------------------------------------------------------------------------------

create policy "Read Codex images of articles you can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'codex-images' and private.can_view_codex_entry(private.codex_image_entry(name)));

create policy "Editors upload Codex images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'codex-images' and private.can_edit_codex_entry(private.codex_image_entry(name)));

create policy "Editors delete Codex images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'codex-images' and private.can_edit_codex_entry(private.codex_image_entry(name)));
