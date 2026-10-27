-- B006: When an account is created without a username (e.g. in the Supabase
-- dashboard), turn the part of the email before "@" into a valid username
-- instead of rejecting the account. "anthony.trimm" becomes "anthony_trimm".
-- A username given in the account's metadata is still used as-is.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_name text := left(regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '_', 'g'), 32);
  new_username text := lower(coalesce(
    new.raw_user_meta_data ->> 'username',
    case when length(email_name) < 3 then rpad(email_name, 3, '_') else email_name end
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

-- "create or replace" keeps the earlier permission removal, but repeat it to be explicit.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
