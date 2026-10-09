-- Live town updates: friends see new memories, building names and members
-- appear without refreshing. Run once in the SQL Editor after schema.sql.
-- RLS still applies to Realtime, so people only receive rows from their own town.

alter publication supabase_realtime add table public.memories;
alter publication supabase_realtime add table public.building_names;
alter publication supabase_realtime add table public.group_members;

-- UPDATE events on building_names (renames) carry the full new row.
alter table public.building_names replica identity full;
