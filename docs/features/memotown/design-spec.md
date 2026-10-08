# Memotown — design spec

**P0** = needed for the demo. **P1** = build only after P0 works end to end on the deployed URL.

The spec uses only existing DESIGN.md tokens. No new values are needed.

## Revision 2 (Oct 8, during the build): these rules override the sections below

- **Look follows the reference image** in `docs/reference/`: `card-tint-mint` ground and fog, near-isometric camera from the south-east, `hairline-strong` streets with `canvas` lane dashes, raised `canvas` plot pads, low-poly `brand-teal` trees, drifting low-poly `canvas` clouds that cast shadows. Replaces the all-white ground.
- **Shared vs solo.** The Add memory form starts with "Who was there?": "With friends" (shared, default) or "Just me" (solo). Helper text: "Shared memories build the city." / "Solo memories grow your lodge in the woods."
- **Shared memories build modern apartments** downtown, one per month: `canvas` floor slabs, `steel` glass bands, a thin band in the author's color per floor. 8+ floors becomes a skyscraper with a setback crown and an antenna.
- **Solo memories grow lodges** in the woods ring around downtown, one lodge per friend: `brand-brown` walls, roof in the friend's color, lit `brand-yellow` windows. It widens with each solo memory and gains a side wing at 3. Label "SAAGII'S LODGE". Clicking it opens a panel titled "Saagii's lodge", "{n} solo memories in the woods".
- **Naming buildings.** The month panel shows the building's name in quotes with a rename button, or a "Name this building" link. Up to 60 characters. The name shows under the month label in the town. Toast: "Building named."
- **Photos.** Picking a photo reads the date it was taken from the photo's metadata and fills "When was it?" (caption under the field: "Date taken from your photo: Jul 14, 2026."). People can still change it. With a photo attached, the text field label becomes "Add a caption (optional)".
- **Progress and unlocks count every memory**, shared and solo.
- **Interim UI:** the shadcn registry is blocked in the cloud build environment, so the first build composes only Button, Card, Input, Label and Sonner. The Add memory dialog and the month sheet are Card panels, the date is a native date input, the story is a one-line Input, and zoom is − / + / reset buttons with a percentage. Swap in Dialog, Sheet, Slider, Textarea, Popover + Calendar, Tabs, Avatar, Progress and Toggle Group once the CLI can add them.

## Routes and entry points

| Route | What it shows | Priority |
| --- | --- | --- |
| `/` | Existing navy landing hero with Memotown copy (see Copy) | P1 |
| `/login` | Existing sign-in. After signing in or signing up, people land on `/town`. | P0 |
| `/town` | The only app screen. Signed-out visitors go to `/login` and come back here afterwards. It shows one of three states: **Onboarding** (not in a town yet), **Empty town** (in a town, no memories) or **Town**. | P0 |
| `/dashboard` | Sends people to `/town` | P0 |

## Screen: Town

The 3D town fills the whole viewport on `canvas`. A few small panels float over it. Each panel is a `card-base` with Elevation level 2 and `{spacing.md}` from the screen edge.

Reading and tab order:

1. **Town bar** (top left)
2. **Account** (top right)
3. **Progress** (bottom left)
4. **Add memory** (bottom center)
5. **Zoom** (bottom right)
6. **The town** (fills the screen behind everything)

### Town bar (P0)

- Town name in `heading-5`, `ink`. Example: "Saagii & friends".
- Below the name, member avatars (Avatar, initials, `caption-bold`). Each avatar has a ring in that friend's color (see Friend colors).
- "Invite" button (`button-ghost`, lucide `UserPlus` icon) opens a Popover:
  - Title: "Invite friends" (`body-sm-medium`).
  - The code in `heading-4`, grouped 4–4 for reading, e.g. `K7QM-2XPA`.
  - Helper text (`caption`, `steel`): "Friends sign up, choose Join with a code, and type this in."
  - "Copy code" button (`button-secondary`). A toast confirms "Invite code copied."
- P1: a "Months" button (`button-ghost`, lucide `CalendarDays`) opens a DropdownMenu of every month with memories, newest first, e.g. "Jul 2026 · 6". Choosing one does the same as clicking that building. This also gives keyboard and screen-reader users a way in.

### Account (P0)

An Avatar with the user's initials opens a DropdownMenu with:

- Their email (`caption`, `steel`, not clickable).
- "Copy invite code".
- "Sign out".

### Progress (P0)

- First line (`body-sm-medium`, `ink`): "{n} memories · {m} months".
- Below it, a Progress bar (fill in `primary`, track in `hairline-soft`) from the last unlock to the next one.
- Under the bar (`caption`, `slate`), what comes next. Use singular forms for 1 ("1 memory", "1 more").

| Group total | Caption |
| --- | --- |
| 1–9 | "{10−n} more until your first park" |
| 10–19 | "{20−n} more until cars hit the streets" |
| 20–29 | "{30−n} more until streetlights and a second park" |
| 30–49 | "{50−n} more until a landmark tower" |
| 50+ | "Your town has everything. Keep it growing." |

### Add memory button (P0)

- `button-primary` with lucide `Plus`: "Add memory". It is the strongest element on screen; nothing else uses `button-primary`.
- It opens the **Add memory** dialog.

### Zoom (P0)

- A horizontal row: an icon button "−" (lucide `Minus`), a Slider, an icon button "+" (lucide `Plus`), then "Reset view" (lucide `Maximize`) with a Tooltip saying "Reset view".
- Slider left = zoomed out (whole town); slider right = zoomed in (one building fills about half the screen).
- "−" and "+" move the slider one tenth of its range.
- The slider, scroll wheel and pinch all control the same zoom. The slider always shows the current zoom.

## The town: what's drawn

The camera has a fixed three-quarter view from above, like a city-builder game. People pan and zoom but never rotate, so nobody gets lost.

| Element | Appears when | Look |
| --- | --- | --- |
| Ground | Always | Flat `canvas` that fades into `canvas` fog at the edges. Plots are outlined in `hairline-soft`. |
| Building | A month has at least one memory, by the memory's "When was it?" date | Stacked `canvas` floors, one per memory. `hairline` edge lines so white reads on white, and a soft shadow on the ground. |
| Floor band | Every floor | A thin band around the base of the floor in the color of the friend who added that memory |
| Month label | Above every building | `micro-uppercase`, `charcoal`, on a small `canvas` chip with a `hairline` border and `{rounded.sm}`. Example: "MAR 2026". |
| Streets | The town has 2 or more buildings | `hairline` strips between plots with `canvas` lane dashes. They extend as the town grows. |
| First park | 10 memories in total | A `card-tint-mint` lawn with round `brand-green` trees on `brand-brown` trunks |
| Cars | 20 memories in total | Small rounded boxes in friends' colors driving slowly along the streets. 3 cars, plus 1 per 10 more memories, up to 8. |
| Second park and streetlights | 30 memories in total | Another park. Thin `steel` posts with `brand-yellow` lamps along the streets. |
| Landmark tower | 50 memories in total | A tall `canvas` tower with a `brand-yellow` top on a plot next to the oldest building |

**Layout rules**

- The oldest month sits at the center. Later months spiral outward, one plot per calendar month.
- A month with no memories leaves an empty lot, so quiet stretches show up as gaps.
- Parks and the landmark take free plots on the outer edge of town.
- A building stops getting taller at 20 floors. Its label still shows the real count.
- If someone adds a memory older than the town's first month, the town lays itself out again with that month at the center.

**Friend colors.** Friends get colors in the order they joined: `brand-orange`, `brand-teal`, `brand-pink`, `brand-green`, `brand-yellow`, `brand-purple`, then the list repeats. Each friend's color is used for their avatar ring, their floor bands and cars.

## Interactions

| Action | Result |
| --- | --- |
| Drag (mouse, or one finger) | Pans the town. The town can't be dragged fully off screen. |
| Scroll wheel or pinch | Zooms. The slider follows. |
| Hover a building (desktop) | Pointer cursor. Building faces tint to `card-tint-lavender`, and the label adds the count: "MAR 2026 · 5". |
| Click or tap a building | The camera glides to center the building, and the **Month sheet** opens. The building stays tinted while the sheet is open. |
| Reset view | The camera glides back to show the whole town. |
| Esc | Closes the sheet or dialog. |
| `+` and `−` keys (P1) | Zoom in and out |

## Motion

- Sheet, dialog, popover and toasts use shadcn defaults (DESIGN.md recommends 150–200ms ease).
- After a memory is added, the camera glides to its building (about 0.6s). Then the new floor grows up from the roof (about 0.5s, ease-out), in the author's color.
- A new month's building rises out of the ground the same way.
- Unlocks: trees and parks pop up with a small overshoot. Cars fade in at the end of a street and start driving.
- Cars loop slowly and never stop.
- With `prefers-reduced-motion`: no glides (the camera cuts), no growth animation, and cars stay parked.

## Add memory dialog (P0)

A Dialog with the title "Add a memory" (`heading-5`). It holds a form with these fields:

| Field | Component | Label | Placeholder or default | Rules |
| --- | --- | --- | --- | --- |
| Title | Input (`text-input`) | "What happened?" | "Late-night ramen after finals" | Required, 80 characters max. A counter appears in the last 20 characters. |
| Story | Textarea | "Tell the story (optional)" | "Who was there, what was funny, what you want to remember." | 2,000 characters max |
| Photo | Input of type file, with a preview | "Add a photo (optional)" | Button text "Choose photo" | One image. JPG, PNG or WebP, 5 MB max. The preview shows at full field width with `{rounded.md}` and a "Remove" `button-link`. |
| Date | Popover with a Calendar, opened by a `button-secondary` showing the date | "When was it?" | Today, e.g. "Oct 8, 2026" | Future dates are disabled. Any past date is allowed. |

- **Buttons:** "Cancel" (`button-secondary`) and "Add to town" (`button-primary`).
- **While saving:** "Adding…" with a spinner. All fields are disabled.
- **Inline errors** (`caption`, `semantic-error`, under the field):
  - Empty title: "Give it a short title."
  - Photo too big: "That photo is over 5 MB. Pick a smaller one."
  - Wrong file type: "Photos only: JPG, PNG or WebP."
- **On success:** the dialog closes, the town animates (see Motion), and a Sonner toast appears:
  - Existing month: "Added to October 2026. Your town grew a floor."
  - New month: "A new building went up for March 2026."
  - Unlocks replace the toast: "Your town just got its first park." · "Cars are on the streets." · "Streetlights are on, and there's a second park." · "A landmark tower rose over your town."
- **On failure:** the dialog stays open with everything still filled in. Error toast: "Couldn't save that memory. Check your connection and try again."

## Month sheet (P0)

A Sheet that opens from the right on desktop and from the bottom on mobile.

- **Header:**
  - Title "July 2026" (`heading-4`).
  - Description (`body-sm`, `slate`): "6 memories from Bat, Nomin and Saagii".
- **Body:** one `card-base` per memory, oldest first, so the month reads like a story. Each card has:
  - The photo, if any, at full card width with `{rounded.md}`. A Skeleton shows while it loads. If it fails to load, show a `card-tint-gray` box with the caption "Photo unavailable".
  - The title in `body-md-medium`, `ink`.
  - The story in `body-md`, `charcoal`.
  - A footer (`caption`, `steel`): a dot in the author's color, then "Bat · Jul 14".
- **P1 footer:** "Add a memory to July" (`button-secondary`). It opens the Add memory dialog with the date set to the 1st of that month.

## Onboarding state (P0)

Shown on `/town` when the signed-in person isn't in a town yet. The empty white ground shows behind a centered `card-feature` with Elevation level 4, the same width as the login form.

- **Header:**
  - Title "Start your town" (`heading-4`).
  - Subtitle (`body-sm`, `slate`): "Memotown turns your group's memories into a little city. Start a town, or join your friends with their code."
- Tabs styled as `segmented-tab`: "Start a town" and "Join with a code".

**Start a town tab**

| Field | Label | Placeholder | Rules |
| --- | --- | --- | --- |
| Town name | "Name your town" | "Saagii & friends" | Required, 40 characters max |
| Your name | "Your name" | "What your friends call you" | Required, 30 characters max. Prefilled from the part of the email before the @. |

The button is "Start town" (`button-primary`).

**Join with a code tab**

| Field | Label | Placeholder | Rules |
| --- | --- | --- | --- |
| Invite code | "Invite code" | "K7QM-2XPA" | 8 characters, typed with or without the dash, any case |
| Your name | "Your name" | "What your friends call you" | Same rules as Start a town |

- The button is "Join town" (`button-primary`).
- Wrong code: "That code doesn't match a town. Check the 8 characters." (`caption`, `semantic-error`).

**After either tab:** the card fades out, and the town (empty or full) appears behind it.

## Other states

- **Empty town (P0):** the ground shows one dashed `hairline-strong` plot at the center, labeled "YOUR FIRST BUILDING" in the month-label style. A `card-base` sits above the Add memory button:
  - "Your town is an empty plot" (`heading-5`).
  - "Add your first memory and the first building goes up. Every memory adds a floor." (`body-sm`, `slate`)
  - "Add the first memory" (`button-primary`). This replaces the bottom button while the town is empty.
  - "Invite friends with code K7QM-2XPA" (`caption`) followed by a "Copy" `button-link`.

  Progress is hidden while the town is empty.
- **Loading (P0):** the panels show immediately, with Skeletons for the town name and avatars. The ground is `canvas` with "Building your town…" centered (`body-sm`, `steel`).
- **Town failed to load (P0):** a centered `card-base` saying "We couldn't load your town." / "Check your connection and try again." with a "Try again" `button-secondary` that reloads the town data.
- **Signed out (P0):** `/town` goes to `/login` and comes back to `/town` after sign-in.
- **No 3D support (P1):** if the browser can't draw 3D, show a `card-base` saying "Your browser can't draw the 3D town." / "You can still add memories and browse them by month." Under it, list the months. Each row opens the Month sheet.

## Mobile (below 768px)

- **Town bar:** one row across the top with the town name (truncated), up to 3 avatars plus "+2", and the Invite icon button. The Account avatar is at the far right.
- **Progress:** one line of caption text under the town bar, without the bar.
- **Zoom:** the slider hides. "−" and "+" icon buttons stack bottom right, above the Add button. Pinch also zooms.
- **Add memory:** a full-width `button-primary` pinned to the bottom, clear of the phone's home bar.
- **Taps:** there is no hover, so the first tap on a building opens its sheet.
- **Month sheet:** slides up from the bottom, 85% of the screen tall at most, and scrolls.
- **Add memory dialog:** fills the width minus `{spacing.md}` on each side and scrolls inside.
- **Touch targets:** at least 44px, per DESIGN.md Touch Targets.

## Copy for existing screens (P1, copy-only tweak)

- **Landing hero:**
  - Headline: "Your friendships, built into a town."
  - Subline: "Every memory your group shares adds a floor. Watch your town grow."
  - Button: "Start your town".
- **Login brand panel line:** "Every hangout adds a floor."
- **Browser tab title:** "Memotown".

## shadcn components

- **Already in the repo:** Button, Card, Input, Label, Sonner.
- **Add with the CLI:** Dialog, Sheet, Slider, Tabs, Textarea, Popover, Calendar, Avatar, Tooltip, Progress, Skeleton, Dropdown Menu.

The 3D town itself is not a UI primitive and has no shadcn equivalent.
