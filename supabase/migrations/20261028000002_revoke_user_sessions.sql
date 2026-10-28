-- B008 follow-up: sign a user out on every device.
--
-- Used by the DM's reset-password script so that a password reset also ends
-- every existing session. Deleting a session also deletes its refresh tokens,
-- so signed-in devices can no longer renew their login; their current access
-- token stops working when it expires (Supabase default: within an hour).
--
-- Only the secret (service_role) key can call this; players and signed-out
-- visitors cannot.

create function public.revoke_user_sessions(target_user uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from auth.sessions where user_id = target_user;
  get diagnostics removed = row_count;
  -- Older refresh tokens may not be linked to a session.
  delete from auth.refresh_tokens where user_id = target_user::text;
  return removed;
end;
$$;

revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
