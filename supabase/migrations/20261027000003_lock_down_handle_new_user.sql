-- B006: handle_new_user() is only meant to run as the profile-creation trigger.
-- Remove the default permission that lets the public API call it directly.
-- The trigger still fires; triggers don't need this permission.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
