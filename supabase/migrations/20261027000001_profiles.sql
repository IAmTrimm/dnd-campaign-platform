-- B005: User profiles
--
-- Supabase stores login details in auth.users. Each login gets one matching
-- row here holding the public-facing username and display name.
-- A profile is created automatically whenever the DM creates a new account.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique
               check (username ~ '^[a-z0-9_]{3,32}$'),
  display_name text not null,
  created_at   timestamptz not null default now()
);

comment on table public.profiles is 'One row per login account: username and display name.';

-- Create the profile when an account is added to auth.users.
-- The username comes from the account's metadata if provided, otherwise
-- from the part of the login email before the "@".
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_username text := lower(coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(new.email, '@', 1)
  ));
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    new_username,
    coalesce(new.raw_user_meta_data ->> 'display_name', new_username)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Access rules are added in a later task. Until then, row level security with
-- no policies means nothing can be read or written through the public API.
alter table public.profiles enable row level security;
