# Hackathon

Next.js 16, Supabase Auth, shadcn/ui, and the Notion `DESIGN.md` from [awesome-design-md](https://github.com/VoltAgent/awesome-design-md).

## Setup

1. Create a Supabase project, then `cp .env.example .env.local` and fill in the URL and publishable key (Project Settings → API).
2. Supabase → Authentication → URL Configuration: add `http://localhost:3000/auth/callback` (and your prod URL) to the redirect URLs.
3. Optional: turn on Google under Authentication → Providers. For fastest testing, turn off "Confirm email".
4. `npm run dev`

## Routes

- `/` is the public landing page.
- `/login` handles email/password sign-in and sign-up, plus Google.
- `/auth/callback` completes the OAuth and email-confirm exchange.
- `/dashboard` is protected (see `PROTECTED` in `lib/supabase/proxy.ts`).

## How we work

See `AGENTS.md`: grill → `docs/features/<slug>/{feature.md,design-spec.md}` → go-ahead → build. shadcn components come from the CLI only.
