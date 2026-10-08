-- =====================================================================
-- Memotown demo seed: 19 memories + 1 building name for the presenter's town
-- =====================================================================
-- Run it in the Supabase SQL Editor AFTER all 4 demo accounts have signed
-- up and joined the same town. The editor runs as "postgres", which
-- bypasses RLS, so this can write memories for every member.
--
-- PITCH TEAM: the titles and stories below are placeholders. Replace them
-- with your real memories. Keep the dates (or at least the same number per
-- month) and the 4 'solo' rows.
--
-- Why these numbers:
--   15 shared: May 2, Jun 2, Jul 4, Aug 4, Sep 2, Oct 1  (downtown skyline)
--    4 solo:   Jun, Jul, Sep, Oct, one by each of the first 4 members (lodges)
--   19 total. The 20th memory, added live on stage, makes the cars appear.
-- Authors: shared memories rotate through the members in the order they
-- joined; solo memory 1 goes to the first member, 2 to the second, and so on.
-- =====================================================================


-- STEP 1: REPLACE THIS EMAIL with the presenter's real account email. ---
select set_config('memotown.seed_email', 'presenter@example.com', false);
-- ----------------------------------------------------------------------


-- STEP 2: add the memories and the building name.
do $$
declare
  v_email    text := current_setting('memotown.seed_email', true);
  v_user_id  uuid;
  v_group_id uuid;
  v_authors  uuid[];  -- town members, in the order they joined
  v_inserted int;
begin
  select u.id into v_user_id
  from auth.users u
  where lower(u.email) = lower(v_email);

  if v_user_id is null then
    raise exception 'seed.sql: no account with email "%". Put the presenter''s email in STEP 1 (they must sign up in the app first).', v_email;
  end if;

  select gm.group_id into v_group_id
  from public.group_members gm
  where gm.user_id = v_user_id;

  if v_group_id is null then
    raise exception 'seed.sql: % is not in a town yet. Start or join the town in the app first.', v_email;
  end if;

  -- Seed rows are the only memories created at exactly 12:00 UTC on their
  -- date. If any exist, this town was already seeded.
  if exists (
    select 1 from public.memories m
    where m.group_id = v_group_id
      and m.created_at = (m.happened_on + time '12:00') at time zone 'UTC'
  ) then
    raise exception 'seed.sql: this town is already seeded. Run the UNDO statements at the bottom first.';
  end if;

  select array_agg(gm.user_id order by gm.joined_at, gm.user_id)
  into v_authors
  from public.group_members gm
  where gm.group_id = v_group_id;

  insert into public.memories (group_id, author_id, kind, title, body, happened_on, created_at)
  select
    v_group_id,
    -- slot 1 -> first member, slot 2 -> second member, ... wrapping around.
    v_authors[((s.slot - 1) % cardinality(v_authors)) + 1],
    s.kind,
    s.title,
    s.body,
    s.happened_on,
    (s.happened_on + time '12:00') at time zone 'UTC'  -- noon UTC on that day
  from (
    -- Number the shared and the solo memories separately, oldest first.
    select v.*, (row_number() over (partition by v.kind order by v.happened_on))::int as slot
    from (values
      -- May 2026: 2 shared
      (date '2026-05-09', 'shared', 'First picnic of the year at Zaisan',
       'The wind almost stole the blanket, but the view over the city was worth it.'),
      (date '2026-05-23', 'shared', 'Hot pot night',
       'Way too much lamb, not enough chairs. Someone dropped a whole block of tofu into the spicy side.'),
      -- June 2026: 2 shared + 1 solo
      (date '2026-06-01', 'shared', 'Children''s Day ice cream run',
       'We are not kids anymore, but we still bought the biggest cones in the shop.'),
      (date '2026-06-12', 'solo',   'Passed my driving test',
       'Third try. The examiner smiled for the first time ever.'),
      (date '2026-06-19', 'shared', 'Last exam done!',
       'Ran straight out of the building and celebrated with bubble tea on Peace Avenue.'),
      -- July 2026: 4 shared + 1 solo
      (date '2026-07-04', 'shared', 'Road trip to Terelj',
       'Four people, one car, way too many snacks. Turtle Rock, horses and zero phone signal.'),
      (date '2026-07-05', 'shared', 'Campfire in Terelj',
       'We stayed up until the sky turned pink. Best night of the summer.'),
      (date '2026-07-11', 'shared', 'Naadam with the crew',
       'Watched the archery, cheered for the wrestlers and ate khuushuur until we couldn''t move.'),
      (date '2026-07-20', 'solo',   'Started morin khuur lessons',
       'My teacher says my bow arm is "brave". The neighbours are being very patient.'),
      (date '2026-07-27', 'shared', 'Surprise birthday party',
       'We hid in the dark for twenty minutes. The cake survived; the candles did not.'),
      -- August 2026: 4 shared
      (date '2026-08-02', 'shared', 'Karaoke marathon',
       'Three hours, one microphone fight and a duet nobody asked for.'),
      (date '2026-08-09', 'shared', 'Open-air concert',
       'Lost our voices by the second song. No regrets.'),
      (date '2026-08-16', 'shared', 'Sunrise hike up Bogd Khan',
       'Left at 5am, regretted it at 5:15, loved it at the top.'),
      (date '2026-08-29', 'shared', 'Last dinner of summer',
       'Grilled everything we could find on the balcony before classes started again.'),
      -- September 2026: 2 shared + 1 solo
      (date '2026-09-01', 'shared', 'First day back',
       'Same campus, new schedules. Met up for lunch to compare classes.'),
      (date '2026-09-13', 'shared', 'Movie night',
       'Three movies, two pizzas, one person asleep before the end.'),
      (date '2026-09-20', 'solo',   'Ran my first 10K',
       'Slow, sweaty and very proud. The medal is on my wall now.'),
      -- October 2026 (on or before Oct 7): 1 shared + 1 solo
      (date '2026-10-03', 'shared', 'Hot pot, round two',
       'It is cold again, so hot pot is back. Same spot, same mountain of lamb.'),
      (date '2026-10-07', 'solo',   'Sketched the first snow',
       'Woke up early and drew the view from my window before it all melted by lunch.')
    ) as v (happened_on, kind, title, body)
  ) as s;

  get diagnostics v_inserted = row_count;

  -- Name July's skyscraper. If July already has a name, this replaces it.
  insert into public.building_names (group_id, month, name, named_by)
  values (v_group_id, date '2026-07-01', 'The best month of my life', v_user_id)
  on conflict (group_id, month)
  do update set name = excluded.name, named_by = excluded.named_by;

  raise notice 'seed.sql: added % memories to town % (% members).',
    v_inserted, v_group_id, cardinality(v_authors);
end
$$;


-- STEP 3: check the result. Expected:
--   2026-05: 2 shared  | 2026-06: 2 + 1 solo | 2026-07: 4 + 1 solo
--   2026-08: 4 shared  | 2026-09: 2 + 1 solo | 2026-10: 1 + 1 solo
--   total: 15 shared + 4 solo = 19 (more if the town already had memories)
select
  coalesce(to_char(m.happened_on, 'YYYY-MM'), 'total') as month,
  count(*) filter (where m.kind = 'shared') as shared,
  count(*) filter (where m.kind = 'solo')   as solo,
  count(*) as memories
from public.memories m
join public.group_members gm on gm.group_id = m.group_id
join auth.users u on u.id = gm.user_id
where lower(u.email) = lower(current_setting('memotown.seed_email', true))
group by rollup (to_char(m.happened_on, 'YYYY-MM'))
order by 1;


-- UNDO (optional): removes this seed's memories and its July building
-- name from the presenter's town, and nothing else. (Seed memories are the
-- only ones created at exactly 12:00 UTC on their date.)
-- To use it: uncomment, put the same email in both statements, select
-- just these lines, and click Run.
--
-- delete from public.memories m
-- using public.group_members gm, auth.users u
-- where lower(u.email) = lower('presenter@example.com')
--   and gm.user_id = u.id
--   and m.group_id = gm.group_id
--   and m.created_at = (m.happened_on + time '12:00') at time zone 'UTC';
--
-- delete from public.building_names b
-- using public.group_members gm, auth.users u
-- where lower(u.email) = lower('presenter@example.com')
--   and gm.user_id = u.id
--   and b.group_id = gm.group_id
--   and b.month = date '2026-07-01'
--   and b.name = 'The best month of my life';
