-- B005: Worlds, campaigns and campaign memberships
--
--   world  1 ──< many  campaigns  1 ──< many  campaign_members  >── 1  profile
--
-- Roles:
--   Owner  – the profile that owns a world (worlds.owner_id). Full control of
--            the world, its shared lore and all of its campaigns.
--   DM     – runs a campaign and decides who belongs to it.
--   Player – a member of a campaign.

create type public.campaign_role as enum ('dm', 'player');

create table public.worlds (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  owner_id    uuid not null references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now()
);

comment on table public.worlds is 'A setting that can contain several campaigns and shared lore.';

create table public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  world_id    uuid not null references public.worlds (id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),

  -- Lets future campaign-specific tables reference (campaign_id, world_id)
  -- together, guaranteeing a campaign's content stays inside its own world.
  unique (id, world_id)
);

comment on table public.campaigns is 'A group of players adventuring in one world.';

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.campaign_role not null default 'player',
  joined_at   timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

comment on table public.campaign_members is 'Who belongs to each campaign, and whether they are its DM or a player.';

create index worlds_owner_id_idx on public.worlds (owner_id);
create index campaigns_world_id_idx on public.campaigns (world_id);
create index campaign_members_user_id_idx on public.campaign_members (user_id);

-- Access rules are added in a later task. Until then, row level security with
-- no policies means nothing can be read or written through the public API.
alter table public.worlds enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
