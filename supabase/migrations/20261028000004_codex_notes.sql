-- B013: Private DM notes for Codex articles.
--
-- Notes live in their own table, separate from the article's public summary and
-- description. Who can read and write them depends ONLY on world ownership and
-- campaign DM roles, never on the article's visibility or discoveries, so
-- publishing or revealing an article can't expose its notes. Players never have
-- access.
--
-- Each article can have:
--   one Owner note        campaign_id empty  -> only the world Owner
--   one note per campaign  campaign_id set    -> that campaign's DMs (and the Owner)
-- A campaign note can only be attached to an article that campaign's DM can see.

create table public.codex_notes (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null,
  world_id    uuid not null,
  campaign_id uuid,
  body        text not null,            -- rich text (HTML), rendered through the same safe viewer as articles
  updated_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  foreign key (entry_id, world_id) references public.codex_entries (id, world_id) on delete cascade,
  foreign key (campaign_id, world_id) references public.campaigns (id, world_id) on delete cascade,
  unique nulls not distinct (entry_id, campaign_id)
);

comment on table public.codex_notes is 'Private DM notes on Codex articles. Never visible to players.';

create index codex_notes_campaign_idx on public.codex_notes (campaign_id) where campaign_id is not null;

create trigger codex_notes_touch_updated_at
  before update on public.codex_notes
  for each row execute function private.touch_updated_at();

-- Owner note: the world Owner. Campaign note: that campaign's DM (or the Owner),
-- and only on an article they are allowed to see.
create function private.can_access_codex_note(target_world uuid, target_campaign uuid, target_entry uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when target_campaign is null then private.is_world_owner(target_world)
    else private.can_manage_campaign(target_campaign) and private.can_view_codex_entry(target_entry)
  end;
$$;

revoke execute on function private.can_access_codex_note(uuid, uuid, uuid) from public;
grant execute on function private.can_access_codex_note(uuid, uuid, uuid) to authenticated;

-- Deny by default; signed-out visitors get nothing. Only the note text can be
-- changed after creation.
revoke all on public.codex_notes from anon, authenticated;
grant select, delete on public.codex_notes to authenticated;
grant insert (entry_id, world_id, campaign_id, body), update (body) on public.codex_notes to authenticated;

alter table public.codex_notes enable row level security;

create policy "DMs see their private notes" on public.codex_notes
  for select to authenticated using (private.can_access_codex_note(world_id, campaign_id, entry_id));
create policy "DMs add their private notes" on public.codex_notes
  for insert to authenticated with check (private.can_access_codex_note(world_id, campaign_id, entry_id));
create policy "DMs change their private notes" on public.codex_notes
  for update to authenticated
  using (private.can_access_codex_note(world_id, campaign_id, entry_id))
  with check (private.can_access_codex_note(world_id, campaign_id, entry_id));
create policy "DMs delete their private notes" on public.codex_notes
  for delete to authenticated using (private.can_access_codex_note(world_id, campaign_id, entry_id));
