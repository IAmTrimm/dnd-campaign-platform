-- B008: Campaign isolation and DM-only access control.
--
-- Who can do what (through the website / public API):
--   Signed-out visitors: nothing.
--   Everyone signed in:  see and rename their own profile (display name only).
--   Players:             see the campaigns they belong to, those campaigns' world,
--                        and the members (and member profiles) of those campaigns.
--   Campaign DM:         also rename their campaign and add, change or remove its members.
--   World Owner:         everything a DM can do in every campaign of their world,
--                        plus rename the world and create new campaigns in it.
-- Nobody can change a world's owner, move a campaign to another world, change a
-- username, or delete worlds/campaigns from the website. The DM's local scripts
-- (secret key) are not affected by these rules.

------------------------------------------------------------------------------
-- 1. Helper checks
-- These run with the definer's rights so policies can look up memberships
-- without triggering each other's policies (avoids recursive RLS). They live in
-- a "private" schema that the public API does not expose.
------------------------------------------------------------------------------

create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.is_world_owner(target_world uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.worlds
    where id = target_world and owner_id = (select auth.uid())
  );
$$;

create function private.is_campaign_member(target_campaign uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = target_campaign and user_id = (select auth.uid())
  );
$$;

-- The campaign's DM, or the Owner of the campaign's world.
create function private.can_manage_campaign(target_campaign uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = target_campaign and user_id = (select auth.uid()) and role = 'dm'
  ) or exists (
    select 1 from public.campaigns c
    join public.worlds w on w.id = c.world_id
    where c.id = target_campaign and w.owner_id = (select auth.uid())
  );
$$;

-- The world's Owner, or a member of any campaign in it.
create function private.can_see_world(target_world uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.worlds
    where id = target_world and owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.campaigns c
    join public.campaign_members m on m.campaign_id = c.id
    where c.world_id = target_world and m.user_id = (select auth.uid())
  );
$$;

-- Your own profile, anyone sharing a campaign with you, and (for Owners)
-- anyone in a campaign of your world.
create function private.can_see_profile(target_profile uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select target_profile = (select auth.uid())
  or exists (
    select 1 from public.campaign_members mine
    join public.campaign_members theirs on theirs.campaign_id = mine.campaign_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target_profile
  ) or exists (
    select 1 from public.campaign_members theirs
    join public.campaigns c on c.id = theirs.campaign_id
    join public.worlds w on w.id = c.world_id
    where theirs.user_id = target_profile and w.owner_id = (select auth.uid())
  );
$$;

revoke execute on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;

------------------------------------------------------------------------------
-- 2. Least-privilege grants
-- Remove Supabase's default "everything" grants, then give signed-in users
-- only the operations (and columns) listed above. Signed-out visitors get none.
------------------------------------------------------------------------------

revoke all on public.profiles, public.worlds, public.campaigns, public.campaign_members
  from anon, authenticated;

grant select on public.profiles, public.worlds, public.campaigns, public.campaign_members
  to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name, description) on public.worlds to authenticated;
grant insert (world_id, name, description), update (name, description) on public.campaigns
  to authenticated;
grant insert (campaign_id, user_id, role), update (role), delete on public.campaign_members
  to authenticated;

-- Future tables start with no access for the public API roles; each new
-- feature's migration must grant exactly what it needs.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

------------------------------------------------------------------------------
-- 3. Row level security policies
------------------------------------------------------------------------------

-- profiles
create policy "See own and fellow members' profiles" on public.profiles
  for select to authenticated using (private.can_see_profile(id));
create policy "Edit own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- worlds
create policy "See worlds you own or play in" on public.worlds
  for select to authenticated using (private.can_see_world(id));
create policy "Owners edit their worlds" on public.worlds
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- campaigns
create policy "See campaigns you belong to or own" on public.campaigns
  for select to authenticated
  using (private.is_campaign_member(id) or private.is_world_owner(world_id));
create policy "Owners create campaigns in their worlds" on public.campaigns
  for insert to authenticated with check (private.is_world_owner(world_id));
create policy "DMs and Owners edit campaigns" on public.campaigns
  for update to authenticated
  using (private.can_manage_campaign(id)) with check (private.can_manage_campaign(id));

-- campaign_members
create policy "See members of your campaigns" on public.campaign_members
  for select to authenticated
  using (private.is_campaign_member(campaign_id) or private.can_manage_campaign(campaign_id));
create policy "DMs and Owners add members" on public.campaign_members
  for insert to authenticated with check (private.can_manage_campaign(campaign_id));
create policy "DMs and Owners change member roles" on public.campaign_members
  for update to authenticated
  using (private.can_manage_campaign(campaign_id)) with check (private.can_manage_campaign(campaign_id));
create policy "DMs and Owners remove members" on public.campaign_members
  for delete to authenticated using (private.can_manage_campaign(campaign_id));
