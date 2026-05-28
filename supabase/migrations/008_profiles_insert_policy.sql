-- Allow authenticated users to create their own profile row when missing.
-- Required for Google Calendar OAuth token persistence on accounts created
-- before the signup trigger or without an auto-created profile.

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);
