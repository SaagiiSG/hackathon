<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Hackathon rules

Read this whole file before touching code. These rules beat your defaults.

## Stack

- Next.js 16 App Router with `cacheComponents: true`. `middleware.ts` is now `proxy.ts`. Read `node_modules/next/dist/docs/` before guessing an API.
- Supabase Auth via `@supabase/ssr`. The clients live in `lib/supabase/{client,server,proxy}.ts`. Get the current user only through `getCurrentUser()` in `lib/auth.ts` (the data access layer).
- Anything that reads cookies or the session must sit inside a `<Suspense>` boundary. With Cache Components, a cookie read outside one is a build error.
- Protected routes are listed in `PROTECTED` in `lib/supabase/proxy.ts`. To protect a new route, add it there. The proxy check is optimistic, so pages still call `getCurrentUser()`.
- Tailwind v4, shadcn/ui (radix base), and lucide icons.

## HARD RULE: shadcn components come from the CLI

- **Every UI primitive is added with the shadcn CLI:** `npx shadcn@latest add <component>`. Check `components/ui/` first, then run `npx shadcn@latest search` or see https://ui.shadcn.com/docs/components for the name.
- **Never hand-write a primitive** (button, dialog, select, tabs, table, sheet, dropdown, toast, form, etc.) and never copy-paste shadcn source from memory or the web. If the CLI has it, the CLI installs it.
- **Do not edit the visual values in `components/ui/*`** to restyle. The look comes from the tokens in `app/globals.css`. Compose primitives in `components/` (for example `components/pricing-card.tsx`), and keep `components/ui/` CLI-owned.
- Add a new npm UI library only when shadcn has no equivalent, and say why in the commit message.

## Visual law: DESIGN.md

`DESIGN.md` is the Notion design system from VoltAgent/awesome-design-md. It decides colors, type, radius, spacing, and component specs (`button-primary`, `card-tint-*`, and so on).

- Its tokens are already wired into `app/globals.css`. The shadcn semantic variables (`--primary`, `--border`, ...) map to Notion values, and the raw palette is available as utilities: `bg-brand-navy`, `bg-card-tint-mint`, `text-slate`, `text-link-blue`, `bg-surface`, and so on.
- Never invent a color, radius, or font size that DESIGN.md already defines. If you need a new value, say so and add it to both DESIGN.md and `globals.css`.
- DESIGN.md component names are **specs, not CSS classes**. `className="button-primary"` styles nothing. Implement them as shadcn components plus Tailwind utilities.
- Light mode only. Do **not** delete `@custom-variant dark (&:is(.dark *))` from `globals.css`; it keeps shadcn's `dark:` variants switched off.
- Do not run `design-tokens` or any skill that generates a competing token system.

## Front-end principles

1. Anything the user needs is reachable within three gestures.
2. Simple beats clever. If a term needs explaining, cut it or define it inline.
3. Take structure from proven enterprise patterns (for example, the login is a 50/50 split with form left and brand right), and take the surface from DESIGN.md.

## Process for every new feature: grill, spec, gate, build

A **feature** is a new route, a new section of a page, or a new thing a user can *do*. Copy tweaks, bug fixes, and restyles skip straight to building.

### 1. Grill (no code)

Run the `grill-me` skill and interview the user relentlessly, one question at a time, until every branch is resolved. Don't settle for the first plausible answer. Stop when you can state, in the user's own words:

- **Who opens this screen**, and what they were doing thirty seconds earlier.
- **The job**: what they come to get done.
- **What it kills**: the manual step, spreadsheet, or DM thread that stops existing. If nothing does, ask why we're building it.
- **Done**: one sentence on what success looks like to that person.
- **What it is not**: the adjacent asks this feature deliberately refuses.
- **Demo moment**: what the judges see in the 30 seconds this feature gets on stage.

### 2. Write two files

In a kebab-case folder named for the feature:

```
docs/features/<feature-slug>/
  feature.md       # who it's for and why it's worth building
  design-spec.md   # what it looks like and how it behaves
```

- **`feature.md`** covers audience and justification only: the user, the job, what it kills, what it is not, the demo moment, and how we'd know it worked. No layout, components, colors, or data model.
- **`design-spec.md`** covers UX and UI only: the entry point, screen structure and section order, every state (empty, loading, error, signed-out), interactions and motion, mobile behavior, and the actual copy. It **names the shadcn components** to use and **cites DESIGN.md tokens and specs by name**. No new values, file paths, or code.

### 3. Gate

Show both files to the user and **get an explicit go-ahead before writing any code.**

### 4. Build

1. `npx shadcn@latest add` whatever `design-spec.md` names that isn't in `components/ui/` yet.
2. Build the smallest vertical slice that works end to end, then iterate.
3. Verify in the browser (sign in, then click through every state in the spec) before you call it done.
4. If the feature changes shape mid-build, update both spec files in the same commit.

Hackathon note: skip ceremony that doesn't buy demo quality. Never skip the grill or the gate; they're what stop us from building the wrong thing at 3am.
