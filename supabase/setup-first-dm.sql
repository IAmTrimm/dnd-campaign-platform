-- One-time setup: link the first DM account to a world and campaign.
--
-- Not a migration; run this by hand once in the Supabase SQL editor,
-- AFTER the DM's login account exists (creating it adds the profile row).
--
-- Replace the three values below before running. They are placeholders so
-- that no real campaign details are stored in this public repository.

do $$
declare
  dm_username   text := 'your_dm_username';
  world_name    text := 'Your World';
  campaign_name text := 'Your Campaign';

  dm_id       uuid;
  new_world   uuid;
  new_campaign uuid;
begin
  select id into dm_id from public.profiles where username = dm_username;
  if dm_id is null then
    raise exception 'No profile found for username "%". Create the account first.', dm_username;
  end if;

  insert into public.worlds (name, owner_id)
  values (world_name, dm_id)
  returning id into new_world;

  insert into public.campaigns (world_id, name)
  values (new_world, campaign_name)
  returning id into new_campaign;

  insert into public.campaign_members (campaign_id, user_id, role)
  values (new_campaign, dm_id, 'dm');
end;
$$;
