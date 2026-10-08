# Supabase setup (Memotown)

- `schema.sql`: tables, security rules (RLS), the `create_group` / `join_group` functions, and the private `memory-photos` bucket.
- `seed.sql`: 19 demo memories and one building name for the presenter's town.

## 1. Create the project

1. On supabase.com, create a new project. Save the database password.
2. Open Project Settings → API. Post the Project URL and the publishable key (`sb_publishable_...`) in the team chat:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
3. Never share the `service_role` / secret key. It skips every security rule.

## 2. Run the schema

1. Open SQL Editor → New query. Paste all of `schema.sql` and click Run.
2. You should see "Success. No rows returned". The file runs as one transaction. If it fails, nothing was created: fix the error and run it again.
3. Check: Table Editor lists `groups`, `group_members`, `memories`, `building_names`. Storage lists a private bucket `memory-photos`.

## 3. Auth settings

1. Authentication → Sign In / Providers → Email: turn OFF "Confirm email" and save (hackathon only).
2. Authentication → URL Configuration → Redirect URLs: add `http://localhost:3000/auth/callback` and `https://<vercel-domain>/auth/callback`.

## 4. Seed the demo town

1. All 4 demo accounts sign up in the app. One starts the town; the other three join with its code.
2. In `seed.sql`, replace `presenter@example.com` in STEP 1 with the presenter's email.
3. Paste the file into a new SQL Editor query and click Run. The result shows 6 months and a total of 15 shared + 4 solo = 19.
4. The town should have no other memories first. At 20 memories the cars appear, and that should happen live on stage.
5. Running the seed twice stops with an error. To redo it, run the UNDO statements at the bottom of `seed.sql` first.

## 5. RLS self-test (2 minutes)

Sign up one more account in the app (the "outsider") and don't join the town. Get the town id as `postgres`: `select id, name, invite_code from public.groups;`

In the SQL Editor, the role selector next to Run shows `postgres`. Switch it to `authenticated`, pick the user, and run:

| Run as | SQL | Expected |
| --- | --- | --- |
| town member | `select count(*) from public.memories;` | 19 |
| outsider | `select count(*) from public.memories;` | 0 |
| outsider | `select * from public.groups;` | no rows |
| outsider | `insert into public.memories (group_id, title) values ('<town id>', 'hi');` | error: new row violates row-level security policy |
| outsider | `insert into public.building_names (group_id, month, name, named_by) values ('<town id>', '2026-10-01', 'x', auth.uid());` | same error |
| outsider | `select count(*) from storage.objects;` | 0 |
| outsider | `select public.join_group('AAAAAAAA', 'X');` | error: invalid_code |
| anon | `select * from public.memories;` | error: permission denied for table memories |

Don't call `join_group` with the real code as the outsider: that joins them to the town.
In the app, the outsider should see "Start your town", never the demo town.

## RPC errors

The app matches these exact messages (`error.message` from `supabase.rpc`):

| Message | When |
| --- | --- |
| `not_signed_in` | no signed-in user |
| `already_in_town` | the caller is already in a town. `join_group` with their own town's code just returns its id. |
| `invalid_name` | town name not 1–40 characters, or your name not 1–30, after trimming spaces |
| `invalid_code` | no town has that code. Every bad code gets this same error. |

A request with no session never reaches the function. It fails with `permission denied for function ...` (HTTP 401).

## Good to know

- Photos go to `memory-photos` at `{group_id}/{uuid}.{jpg|png|webp}`. Upload with `upsert: false` and show them with `createSignedUrl`. The bucket is private, so `getPublicUrl` won't work. Photos can't be overwritten or deleted.
- Memories can't be edited or deleted. Any member can rename a building (upsert on `group_id,month`). The last write wins.
- The Security Advisor may warn that signed-in users can call these SECURITY DEFINER functions. That is intended.
- `schema.sql` is for a fresh project. To start over, use the commented "Start over" block at the end of the file.
