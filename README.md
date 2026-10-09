# Memotown

A friend group shares one white 3D city. Each month of shared memories is a building that grows a floor. Solo memories grow that person's lodge. Parks, cars, streetlights, and a landmark show up as the town gets bigger.

Sign up with email, start a town or join with an 8-character code, and add a photo. The city updates for everyone in the town.

**Live demo:** [memotown.vercel.app/town](https://memotown.vercel.app/town)

## Team

- [Saran Ochir](https://github.com/SaagiiSG) - frontend, 3D city, UI, and Vercel
- [Enkhbuted Munguntulga](https://github.com/welcometovicecity) - frontend UI
- [Tomi Alo](https://github.com/tomi-alo) - Supabase project, auth, Postgres, and private photo storage
- [Hachem Abou Saleh](https://github.com/g4nmzrrzwn-blip) - product idea, pitch and organization

## Setup

1. `cp .env.example .env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. In the Supabase SQL Editor, run `supabase/schema.sql`.
3. Authentication → URL Configuration: add `http://localhost:3000/auth/callback` and `https://memotown.vercel.app/auth/callback`.
4. `npm install` and `npm run dev`.

`supabase/seed.sql` loads the 19-memory demo town. Details are in `supabase/README.md`.
