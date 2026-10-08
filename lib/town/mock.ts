import type { Memory, Member, Town, TownState, Viewer } from "./types";

// Fake town used until Supabase is live, and as the demo fallback.
// 19 memories, so the 20th one added on stage unlocks cars.

export const MOCK_VIEWER: Viewer = { id: "mock-saagii", email: "saagii@example.com" };

const members: Member[] = [
  { userId: "mock-saagii", displayName: "Saagii", joinedAt: "2026-05-01T10:00:00Z", colorIndex: 0 },
  { userId: "mock-bat", displayName: "Bat", joinedAt: "2026-05-01T10:05:00Z", colorIndex: 1 },
  { userId: "mock-nomin", displayName: "Nomin", joinedAt: "2026-05-01T10:09:00Z", colorIndex: 2 },
  { userId: "mock-anu", displayName: "Anu", joinedAt: "2026-05-02T08:30:00Z", colorIndex: 3 },
];

type Row = [string, Memory["kind"], string, string, string];

const rows: Row[] = [
  ["2026-05-09", "shared", "mock-saagii", "First picnic of the year", "Too cold to sit down, ate everything standing up anyway."],
  ["2026-05-23", "shared", "mock-bat", "Hot pot night", "Nomin ordered the spicy broth and regretted it immediately."],
  ["2026-06-06", "shared", "mock-nomin", "Finals survival night", "Three energy drinks, one whiteboard, zero sleep."],
  ["2026-06-14", "solo", "mock-saagii", "Got my first internship offer", "Read the email four times before telling anyone."],
  ["2026-06-20", "shared", "mock-anu", "Naadam practice at the stadium", "Anu lost every archery round and still talked the most."],
  ["2026-07-04", "shared", "mock-saagii", "Road trip to Terelj", "The car radio only played one song. We know all the words now."],
  ["2026-07-05", "shared", "mock-bat", "Turtle Rock at sunrise", "Worth the 5am alarm. Barely."],
  ["2026-07-11", "shared", "mock-nomin", "Naadam with the whole crew", "Khuushuur for breakfast, lunch and dinner."],
  ["2026-07-18", "solo", "mock-bat", "Solo hike up Bogd Khan", "Just me, the wind, and a very judgmental marmot."],
  ["2026-07-25", "shared", "mock-anu", "Karaoke until 3am", "Bat's ballad will never be forgotten. We tried."],
  ["2026-08-02", "shared", "mock-saagii", "Bat's birthday", "Cake fell on the floor. Five-second rule applied to all of it."],
  ["2026-08-09", "solo", "mock-nomin", "Finished my first painting", "It's a horse. Probably."],
  ["2026-08-15", "shared", "mock-bat", "Concert at the Square", "Lost Anu twice. Found her at the khuushuur stand both times."],
  ["2026-08-22", "shared", "mock-nomin", "Rainy day board games", "Monopoly ended two friendships for exactly one hour."],
  ["2026-08-29", "shared", "mock-anu", "Last swim of summer", "The river was freezing. Nobody admitted it."],
  ["2026-09-05", "shared", "mock-saagii", "First day back on campus", "Same table in the canteen, like nothing changed."],
  ["2026-09-19", "shared", "mock-bat", "Late-night ramen after the quiz", "Nobody talked about the quiz."],
  ["2026-09-27", "solo", "mock-anu", "Ran my first 10K", "Slow, but I didn't stop once."],
  ["2026-10-03", "shared", "mock-nomin", "Autumn walk up Zaisan", "The whole city turned gold for one weekend."],
];

const memories: Memory[] = rows.map(([happenedOn, kind, authorId, title, body], i) => ({
  id: `mock-${i + 1}`,
  authorId,
  kind,
  title,
  body,
  photoUrl: null,
  happenedOn,
  createdAt: `${happenedOn}T12:00:00Z`,
}));

export const MOCK_TOWN: Town = {
  id: "mock-town",
  name: "Saagii & friends",
  inviteCode: "K7QM2XPA",
  members,
  memories,
  buildingNames: { "2026-07": "The best month of my life" },
};

// `?preview=onboarding` or `?preview=empty` shows those states with fake data.
export function mockState(preview?: string): TownState {
  if (preview === "onboarding") {
    return { kind: "onboarding", viewer: MOCK_VIEWER, suggestedName: "saagii" };
  }
  if (preview === "empty") {
    return {
      kind: "town",
      viewer: MOCK_VIEWER,
      town: { ...MOCK_TOWN, members: [members[0]], memories: [], buildingNames: {} },
    };
  }
  return { kind: "town", viewer: MOCK_VIEWER, town: MOCK_TOWN };
}
