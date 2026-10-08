-- =====================================================================
-- Memotown database schema (Supabase / Postgres)
-- =====================================================================
-- Run this ONCE on a fresh Supabase project:
--   SQL Editor -> New query -> paste this whole file -> Run.
-- The editor runs the file as one transaction: if any statement fails,
-- nothing is created. Fix the problem and run the whole file again.
--
-- What it creates, in order:
--   1. Tables: groups, group_members, memories, building_names
--   2. Helper: is_group_member(gid), used by the security policies
--   3. Row Level Security (RLS): which rows each user can read or write
--   4. RPCs: create_group(...) and join_group(...)
--   5. Grants: which API roles may touch which table or function
--   6. Storage: the private "memory-photos" bucket and its policies
--
-- Words you will see:
--   anon          = an API request with no signed-in user
--   authenticated = an API request from a signed-in user
--   auth.uid()    = the signed-in user's id (null when nobody is signed in)
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

-- A town. One per friend group.
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null
              check (char_length(name) between 1 and 40 and btrim(name) <> ''),
  -- 8 characters, uppercase, no dash, no look-alikes (no 0, O, 1, I, L).
  -- The app shows it as "K7QM-2XPA"; join_group() removes the dash.
  invite_code text not null unique
              check (invite_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$'),
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- Who is in which town.
create table public.group_members (
  group_id     uuid not null references public.groups (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  display_name text not null
               check (char_length(display_name) between 1 and 30 and btrim(display_name) <> ''),
  joined_at    timestamptz not null default now(),  -- join order decides friend colors
  primary key (group_id, user_id),
  unique (user_id)                                   -- one town per person
);

-- One memory = one floor. It is a photo memory if photo_path is set.
create table public.memories (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  author_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null
              check (char_length(title) between 1 and 80 and btrim(title) <> ''),
  body        text check (body is null or char_length(body) <= 2000),
  -- Path inside the "memory-photos" bucket: '{group_id}/{random uuid}.{jpg|png|webp}'
  photo_path  text,
  -- The date it happened decides the month (building). Today + 1 day is
  -- allowed because the database clock is UTC and Mongolia is UTC+8.
  happened_on date not null default current_date
              check (happened_on <= current_date + 1),
  created_at  timestamptz not null default now(),
  -- 'shared' memories build the downtown skyscrapers;
  -- 'solo' memories grow the author's lodge in the woods. Everyone in the town sees both.
  kind        text not null default 'shared'
              check (kind in ('shared', 'solo'))
);

-- A custom name for one month's skyscraper, e.g. "The best month of my life".
-- Any member can rename it; the last write wins.
create table public.building_names (
  group_id   uuid not null references public.groups (id) on delete cascade,
  month      date not null check (extract(day from month) = 1),  -- always the 1st of the month
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  named_by   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (group_id, month)
);

-- The town screen loads a group's memories by date.
create index memories_group_id_happened_on_idx on public.memories (group_id, happened_on);

-- Indexes on the other foreign keys: fast cascading deletes, and they keep
-- Supabase's Performance Advisor quiet.
create index memories_author_id_idx on public.memories (author_id);
create index groups_created_by_idx on public.groups (created_by);
create index building_names_named_by_idx on public.building_names (named_by);

-- Keep building_names.updated_at current when someone renames a building.
create function public.building_names_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger building_names_set_updated_at
  before update on public.building_names
  for each row execute function public.building_names_set_updated_at();


-- ---------------------------------------------------------------------
-- 2. Helper used by the policies
-- ---------------------------------------------------------------------
-- True if the signed-in user is a member of town gid.
--
-- SECURITY DEFINER: runs as the function's owner, so it reads
-- group_members without going through group_members' own policy.
-- (A policy on group_members that queried group_members directly would
-- call itself forever: "infinite recursion detected in policy".)
-- search_path = '' plus fully qualified names: nobody can trick the
-- function into using a look-alike table or function from another schema.
create function public.is_group_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = gid
      and gm.user_id = (select auth.uid())
  );
$$;


-- ---------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------
-- With RLS on, a table returns no rows and accepts no writes unless a
-- policy allows it. A missing policy means "no".
-- "(select auth.uid())" instead of "auth.uid()" lets Postgres compute the
-- user id once per query instead of once per row (Supabase's advice).

alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.memories       enable row level security;
alter table public.building_names enable row level security;

-- groups: members can read their own town (including its invite code).
-- No insert/update/delete policies: towns are created only by create_group().
create policy "groups: members can read their town"
  on public.groups for select
  to authenticated
  using (public.is_group_member(id));

-- group_members: members see everyone in their town.
-- No insert/update/delete policies: people join only through the RPCs.
create policy "group_members: members can see each other"
  on public.group_members for select
  to authenticated
  using (public.is_group_member(group_id));

-- memories: members read every memory in their town (shared and solo).
create policy "memories: members can read"
  on public.memories for select
  to authenticated
  using (public.is_group_member(group_id));

-- memories: members add memories to their own town, as themselves.
-- A photo must sit in the town's own folder, and ".." is never allowed.
-- No update/delete policies: memories can't be edited in this build.
create policy "memories: members can add their own"
  on public.memories for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_group_member(group_id)
    and (
      photo_path is null
      or (starts_with(photo_path, group_id::text || '/') and strpos(photo_path, '..') = 0)
    )
  );

-- building_names: members read their town's building names.
create policy "building_names: members can read"
  on public.building_names for select
  to authenticated
  using (public.is_group_member(group_id));

-- building_names: the app saves names with an upsert
--   .upsert({ group_id, month, name, named_by }, { onConflict: 'group_id,month' })
-- A new name goes through the INSERT policy, a rename through the UPDATE
-- policy, so both exist. named_by must always be the caller.
-- No delete policy.
create policy "building_names: members can name buildings"
  on public.building_names for insert
  to authenticated
  with check (
    public.is_group_member(group_id)
    and named_by = (select auth.uid())
  );

create policy "building_names: members can rename buildings"
  on public.building_names for update
  to authenticated
  using (public.is_group_member(group_id))
  with check (
    public.is_group_member(group_id)
    and named_by = (select auth.uid())
  );


-- ---------------------------------------------------------------------
-- 4. RPCs (the app calls them with supabase.rpc('create_group', {...}))
-- ---------------------------------------------------------------------
-- Both run as SECURITY DEFINER because they write to groups and
-- group_members, which users can't write to directly.
-- Errors use exact snake_case messages; the app matches on them:
--   not_signed_in, already_in_town, invalid_name, invalid_code

-- Start a new town and become its first member. Returns the town id.
create function public.create_group(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_name     text := btrim(p_name);
  v_display  text := btrim(p_display_name);
  -- 31 characters: A-Z without I, L, O, plus 2-9.
  c_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code     text;
  v_bytes    bytea;
  v_byte     int;
  v_group_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  if exists (select 1 from public.group_members gm where gm.user_id = v_uid) then
    raise exception 'already_in_town';
  end if;

  if coalesce(char_length(v_name), 0) not between 1 and 40
     or coalesce(char_length(v_display), 0) not between 1 and 30 then
    raise exception 'invalid_name';
  end if;

  -- Make a random invite code and insert the town. If the code is already
  -- taken (unique_violation), make a new code and try again.
  for v_attempt in 1..10 loop
    v_code := '';
    while char_length(v_code) < 8 loop
      -- gen_random_uuid() is built into Postgres (pg_catalog, so it works with
      -- an empty search_path) and uses a cryptographically strong random source.
      -- Its 16 bytes are random except bytes 6 and 8 (UUID version/variant bits).
      v_bytes := uuid_send(gen_random_uuid());
      for i in 0..15 loop
        continue when i in (6, 8);
        v_byte := get_byte(v_bytes, i);
        -- Use only bytes 0..247 (= 8 x 31) so every character is equally likely.
        continue when v_byte >= 248;
        v_code := v_code || substr(c_alphabet, (v_byte % 31) + 1, 1);
        exit when char_length(v_code) = 8;
      end loop;
    end loop;

    begin
      insert into public.groups (name, invite_code, created_by)
      values (v_name, v_code, v_uid)
      returning id into v_group_id;
      exit;  -- inserted: stop retrying
    exception when unique_violation then
      if v_attempt = 10 then
        raise;  -- 10 collisions in a row: practically impossible
      end if;
    end;
  end loop;

  begin
    insert into public.group_members (group_id, user_id, display_name)
    values (v_group_id, v_uid, v_display);
  exception when unique_violation then
    -- A parallel request (double click) put this user in a town a moment
    -- ago. Raising here also undoes the town inserted above.
    raise exception 'already_in_town';
  end;

  return v_group_id;
end;
$$;

-- Join a town with its invite code. Returns the town id.
-- Calling it again for the town you're already in just returns its id.
create function public.join_group(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  -- 'k7qm-2xpa' -> 'K7QM2XPA': uppercase, then drop dashes, spaces and
  -- any other character that can't be part of a code.
  v_code     text := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  v_display  text := btrim(p_display_name);
  v_group_id uuid;
  v_current  uuid;  -- the town the caller is already in, if any
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  select g.id into v_group_id
  from public.groups g
  where g.invite_code = v_code;

  if v_group_id is null then
    -- Same error for every bad code (empty, malformed, unknown):
    -- it tells the caller nothing about which towns exist.
    raise exception 'invalid_code';
  end if;

  select gm.group_id into v_current
  from public.group_members gm
  where gm.user_id = v_uid;

  if v_current = v_group_id then
    return v_group_id;  -- already in this town: nothing to do
  elsif v_current is not null then
    raise exception 'already_in_town';
  end if;

  if coalesce(char_length(v_display), 0) not between 1 and 30 then
    raise exception 'invalid_name';
  end if;

  begin
    insert into public.group_members (group_id, user_id, display_name)
    values (v_group_id, v_uid, v_display);
  exception when unique_violation then
    -- A parallel request (double click) got there first.
    if exists (select 1 from public.group_members gm
               where gm.group_id = v_group_id and gm.user_id = v_uid) then
      return v_group_id;
    end if;
    raise exception 'already_in_town';
  end;

  return v_group_id;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------
-- By default Supabase gives anon and authenticated every privilege on new
-- public tables and relies on RLS alone. We also cut privileges down to
-- what the app actually uses, so RLS is never the only line of defense.
-- (TRUNCATE, for example, ignores RLS.)
revoke all on table public.groups, public.group_members, public.memories, public.building_names
  from anon, authenticated;
grant select on table public.groups, public.group_members to authenticated;
grant select, insert on table public.memories to authenticated;
grant select, insert, update on table public.building_names to authenticated;  -- upsert = insert + update
-- service_role (the secret server key) bypasses RLS anyway; keep it working for admin scripts.
grant all on table public.groups, public.group_members, public.memories, public.building_names
  to service_role;

-- Postgres lets everyone (PUBLIC) execute new functions. Lock them down:
-- only signed-in users may call the RPCs and the helper.
revoke execute on function public.is_group_member(uuid)       from public, anon;
revoke execute on function public.create_group(text, text)    from public, anon;
revoke execute on function public.join_group(text, text)      from public, anon;
grant  execute on function public.is_group_member(uuid)       to authenticated;
grant  execute on function public.create_group(text, text)    to authenticated;
grant  execute on function public.join_group(text, text)      to authenticated;
-- The trigger function is only ever run by its trigger.
revoke execute on function public.building_names_set_updated_at() from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- 6. Storage: private bucket for memory photos
-- ---------------------------------------------------------------------
-- Private means no public URLs: the app shows photos through signed URLs
-- (supabase.storage.from('memory-photos').createSignedUrl(path, seconds)).
-- The Storage API enforces the 5 MB limit and the JPG/PNG/WebP types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memory-photos', 'memory-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Object names look like '{group_id}/{random uuid}.jpg', so
-- (storage.foldername(name))[1] (the first folder) is the town id.
-- We compare it as TEXT with the caller's town ids: a folder that isn't a
-- uuid simply doesn't match, instead of failing with a cast error.
-- RLS is already on for storage.objects. Don't ALTER that table: Supabase
-- owns it and the statement fails.
-- No UPDATE/DELETE policies: photos can't be overwritten or deleted
-- (so uploads must use upsert: false and a fresh file name).
create policy "memory-photos: members can view town photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] in (
      select gm.group_id::text
      from public.group_members gm
      where gm.user_id = (select auth.uid())
    )
  );

create policy "memory-photos: members can upload to town folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'memory-photos'
    and (storage.foldername(name))[1] in (
      select gm.group_id::text
      from public.group_members gm
      where gm.user_id = (select auth.uid())
    )
    and strpos(name, '..') = 0
  );


-- ---------------------------------------------------------------------
-- Start over (DANGER: deletes every town, member, memory and building
-- name; photos stay in the bucket). Uncomment, select these lines, Run.
-- Then run this whole file again.
-- ---------------------------------------------------------------------
-- drop policy if exists "memory-photos: members can view town photos" on storage.objects;
-- drop policy if exists "memory-photos: members can upload to town folder" on storage.objects;
-- drop table if exists public.building_names, public.memories, public.group_members, public.groups cascade;
-- drop function if exists public.create_group(text, text), public.join_group(text, text),
--   public.is_group_member(uuid), public.building_names_set_updated_at();
