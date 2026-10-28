-- B011: Codex database structure.
--
--   codex_entries  One entry: an NPC, location, faction, item or piece of lore.
--                  Belongs to a world; optionally specific to one campaign.
--   codex_links    A named relationship between two entries ("lives in",
--                  "member of", "owns"...). Can itself be secret.
--   codex_reveals  A DM-only world entry revealed to one campaign's players
--                  (what that party has discovered).
--
-- Every entry has a permanent id, so future map markers and timeline events can
-- point at the same entries (reference codex_entries (id, world_id)).
--
-- Who sees an entry or link:
--   visibility 'draft'   (unpublished)  only the people who can edit it
--   visibility 'dm'      (DM secret)    the world Owner and DMs; for a campaign
--                                       entry, that campaign's DM. Players only
--                                       if it has been revealed to their campaign.
--   visibility 'players' (published)    world entry: players of every campaign
--                                       in the world; campaign entry: that
--                                       campaign's players only.
-- Who edits: world entries and links, the world Owner; campaign entries and
-- links, that campaign's DM (and the world Owner).

create type public.codex_category as enum ('npc', 'location', 'faction', 'item', 'lore');
create type public.codex_visibility as enum ('draft', 'dm', 'players');

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table public.codex_entries (
  id          uuid primary key default gen_random_uuid(),
  world_id    uuid not null references public.worlds (id) on delete cascade,
  campaign_id uuid,                     -- empty = world lore shared by all campaigns
  category    public.codex_category not null,
  name        text not null check (length(trim(name)) > 0),
  summary     text,                     -- one or two lines for lists and previews
  description text,                     -- the full write-up
  tags        text[] not null default '{}',
  visibility  public.codex_visibility not null default 'draft',
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  foreign key (campaign_id, world_id) references public.campaigns (id, world_id) on delete cascade,
  -- Lets links, reveals and future maps/timelines guarantee they stay in one world.
  unique (id, world_id)
);

comment on table public.codex_entries is 'Codex: NPCs, locations, factions, items and lore for a world or one campaign.';

create table public.codex_links (
  id            uuid primary key default gen_random_uuid(),
  world_id      uuid not null references public.worlds (id) on delete cascade,
  campaign_id   uuid,                   -- empty = a world-level fact
  from_entry_id uuid not null,
  to_entry_id   uuid not null,
  relation      text not null check (length(trim(relation)) > 0),  -- e.g. 'lives in', 'member of'
  visibility    public.codex_visibility not null default 'draft',
  created_at    timestamptz not null default now(),

  foreign key (from_entry_id, world_id) references public.codex_entries (id, world_id) on delete cascade,
  foreign key (to_entry_id, world_id) references public.codex_entries (id, world_id) on delete cascade,
  foreign key (campaign_id, world_id) references public.campaigns (id, world_id) on delete cascade,
  check (from_entry_id <> to_entry_id),
  unique nulls not distinct (from_entry_id, to_entry_id, relation, campaign_id)
);

comment on table public.codex_links is 'Named relationships between Codex entries in the same world.';

create table public.codex_reveals (
  entry_id    uuid not null,
  campaign_id uuid not null,
  world_id    uuid not null,
  revealed_at timestamptz not null default now(),
  primary key (entry_id, campaign_id),

  foreign key (entry_id, world_id) references public.codex_entries (id, world_id) on delete cascade,
  foreign key (campaign_id, world_id) references public.campaigns (id, world_id) on delete cascade
);

comment on table public.codex_reveals is 'DM-only entries that a campaign''s players have discovered.';

create index codex_entries_world_idx on public.codex_entries (world_id, category);
create index codex_entries_campaign_idx on public.codex_entries (campaign_id) where campaign_id is not null;
create index codex_entries_tags_idx on public.codex_entries using gin (tags);
create index codex_links_from_idx on public.codex_links (from_entry_id);
create index codex_links_to_idx on public.codex_links (to_entry_id);
create index codex_reveals_campaign_idx on public.codex_reveals (campaign_id);

-- Keep updated_at current on every edit.
create function private.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger codex_entries_touch_updated_at
  before update on public.codex_entries
  for each row execute function private.touch_updated_at();

------------------------------------------------------------------------------
-- Visibility and editing rules (helper checks, not exposed through the API)
------------------------------------------------------------------------------

-- Can the current user add, change or delete Codex content in this scope?
-- World scope: the world Owner. Campaign scope: that campaign's DM or the Owner.
create function private.can_edit_codex(target_world uuid, target_campaign uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    when target_campaign is null then private.is_world_owner(target_world)
    else private.can_manage_campaign(target_campaign)
  end;
$$;

-- Is the current user a DM of any campaign in this world?
create function private.is_dm_in_world(target_world uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members m
    join public.campaigns c on c.id = m.campaign_id
    where c.world_id = target_world and m.user_id = (select auth.uid()) and m.role = 'dm'
  );
$$;

-- The single visibility rule shared by entries and links (target_entry is the
-- entry whose reveals count; links pass null, as links can't be revealed).
create function private.codex_visible(
  target_world uuid, target_campaign uuid, target_visibility public.codex_visibility, target_entry uuid
)
returns boolean language sql stable security definer set search_path = ''
as $$
  select case
    -- Editors see everything they can edit, including drafts.
    when private.can_edit_codex(target_world, target_campaign) then true
    when target_visibility = 'draft' then false
    -- Campaign-specific content: only that campaign.
    when target_campaign is not null then
      private.is_campaign_member(target_campaign) and (
        target_visibility = 'players'
        or exists (
          select 1 from public.codex_reveals r
          where r.entry_id = target_entry and r.campaign_id = target_campaign
        )
      )
    -- World lore published to players: every campaign in the world.
    when target_visibility = 'players' then private.can_see_world(target_world)
    -- World DM secret: DMs in the world, and players whose campaign discovered it.
    else private.is_dm_in_world(target_world) or exists (
      select 1 from public.codex_reveals r
      join public.campaign_members m on m.campaign_id = r.campaign_id
      where r.entry_id = target_entry and m.user_id = (select auth.uid())
    )
  end;
$$;

create function private.can_view_codex_entry(target_entry uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select private.codex_visible(e.world_id, e.campaign_id, e.visibility, e.id)
    from public.codex_entries e where e.id = target_entry
  ), false);
$$;

revoke execute on all functions in schema private from public;
grant execute on function private.can_edit_codex(uuid, uuid), private.is_dm_in_world(uuid),
  private.codex_visible(uuid, uuid, public.codex_visibility, uuid), private.can_view_codex_entry(uuid)
  to authenticated;

------------------------------------------------------------------------------
-- Grants: deny by default, then allow only what the rules below need.
-- World, campaign and creator can't be changed after creation.
------------------------------------------------------------------------------

revoke all on public.codex_entries, public.codex_links, public.codex_reveals from anon, authenticated;

grant select, delete on public.codex_entries, public.codex_links, public.codex_reveals to authenticated;
grant insert (world_id, campaign_id, category, name, summary, description, tags, visibility),
      update (category, name, summary, description, tags, visibility)
  on public.codex_entries to authenticated;
grant insert (world_id, campaign_id, from_entry_id, to_entry_id, relation, visibility),
      update (relation, visibility)
  on public.codex_links to authenticated;
grant insert (entry_id, campaign_id, world_id) on public.codex_reveals to authenticated;

------------------------------------------------------------------------------
-- Row level security
------------------------------------------------------------------------------

alter table public.codex_entries enable row level security;
alter table public.codex_links enable row level security;
alter table public.codex_reveals enable row level security;

-- codex_entries
create policy "See Codex entries you're allowed to" on public.codex_entries
  for select to authenticated
  using (private.codex_visible(world_id, campaign_id, visibility, id));
create policy "Editors add Codex entries" on public.codex_entries
  for insert to authenticated with check (private.can_edit_codex(world_id, campaign_id));
create policy "Editors change Codex entries" on public.codex_entries
  for update to authenticated
  using (private.can_edit_codex(world_id, campaign_id))
  with check (private.can_edit_codex(world_id, campaign_id));
create policy "Editors delete Codex entries" on public.codex_entries
  for delete to authenticated using (private.can_edit_codex(world_id, campaign_id));

-- codex_links: visible only if the link itself and both ends are visible.
create policy "See Codex links you're allowed to" on public.codex_links
  for select to authenticated
  using (
    private.codex_visible(world_id, campaign_id, visibility, null)
    and private.can_view_codex_entry(from_entry_id)
    and private.can_view_codex_entry(to_entry_id)
  );
create policy "Editors add Codex links" on public.codex_links
  for insert to authenticated with check (private.can_edit_codex(world_id, campaign_id));
create policy "Editors change Codex links" on public.codex_links
  for update to authenticated
  using (private.can_edit_codex(world_id, campaign_id))
  with check (private.can_edit_codex(world_id, campaign_id));
create policy "Editors delete Codex links" on public.codex_links
  for delete to authenticated using (private.can_edit_codex(world_id, campaign_id));

-- codex_reveals: a campaign's DM (or the Owner) records what their party has
-- discovered; that campaign's members can see the list.
create policy "See your campaigns' discoveries" on public.codex_reveals
  for select to authenticated
  using (private.is_campaign_member(campaign_id) or private.can_manage_campaign(campaign_id));
create policy "DMs record discoveries" on public.codex_reveals
  for insert to authenticated with check (private.can_manage_campaign(campaign_id));
create policy "DMs remove discoveries" on public.codex_reveals
  for delete to authenticated using (private.can_manage_campaign(campaign_id));
