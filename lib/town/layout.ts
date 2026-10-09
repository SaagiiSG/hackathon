import { longMonthLabel, monthIndex, monthKey, shortMonthLabel } from "./dates";
import type { Member, Memory } from "./types";

// World units. One plot holds one building; streets run between plots.
export const PLOT = 4;
export const STREET = 1.1;
export const FOOTPRINT = 2.3;
export const FLOOR_H = 0.62;
export const MAX_FLOORS = 20;

export type Plot = { x: number; z: number };

export type Floor = { memoryId: string; colorIndex: number };

export type Building = {
  key: string; // "month:2026-07"
  month: string; // "2026-07"
  label: string; // "JUL 2026"
  longLabel: string; // "July 2026"
  name: string | null;
  plot: Plot;
  floors: Floor[]; // capped at MAX_FLOORS
  count: number; // real count, shown on the label
};

export type Lodge = {
  key: string; // "lodge:<userId>"
  userId: string;
  displayName: string;
  colorIndex: number;
  x: number;
  z: number;
  angle: number;
  count: number;
};

export type Road = { x1: number; z1: number; x2: number; z2: number };

export type TownLayout = {
  buildings: Building[];
  emptyLots: Plot[];
  plazas: Plot[]; // free plots inside downtown
  parks: Plot[];
  landmark: Plot | null;
  radius: number; // downtown extent in plots from the center
  half: number; // downtown half-size in world units
  streets: boolean;
  carCount: number;
  streetlights: boolean;
  roads: Road[]; // roads leading out of downtown, to the lodges and into the woods
  lodges: Lodge[];
  lodgeRing: number; // world radius of the woods ring
  outer: number; // world radius that holds everything
  trees: { x: number; z: number; s: number }[];
  total: number;
  months: number;
};

// Square spiral: 0 → (0,0), then outward ring by ring.
export function spiral(n: number): Plot {
  let x = 0;
  let z = 0;
  let dx = 1;
  let dz = 0;
  let len = 1;
  let walked = 0;
  let turns = 0;
  for (let i = 0; i < n; i++) {
    x += dx;
    z += dz;
    walked++;
    if (walked === len) {
      walked = 0;
      [dx, dz] = [-dz, dx];
      turns++;
      if (turns % 2 === 0) len++;
    }
  }
  return { x, z };
}

export const UNLOCKS = [
  { at: 10, next: "until your first park", message: "Your town just got its first park." },
  { at: 20, next: "until rush hour", message: "Rush hour: more cars are on the streets." },
  { at: 30, next: "until streetlights and a second park", message: "Streetlights are on, and there's a second park." },
  { at: 50, next: "until a landmark tower", message: "A landmark tower rose over your town." },
] as const;

export function unlockCrossed(before: number, after: number) {
  return UNLOCKS.find((u) => before < u.at && after >= u.at)?.message ?? null;
}

export function progressFor(total: number) {
  const next = UNLOCKS.find((u) => total < u.at);
  if (!next) return { pct: 100, caption: "Your town has everything. Keep it growing." };
  const prev = [...UNLOCKS].reverse().find((u) => total >= u.at)?.at ?? 0;
  const left = next.at - total;
  return {
    pct: Math.round(((total - prev) / (next.at - prev)) * 100),
    caption: `${left} more ${next.next}`,
  };
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function segmentDist(x: number, z: number, r: Road) {
  const dx = r.x2 - r.x1;
  const dz = r.z2 - r.z1;
  const t = Math.max(0, Math.min(1, ((x - r.x1) * dx + (z - r.z1) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (r.x1 + t * dx), z - (r.z1 + t * dz));
}

// Small deterministic random so the woods don't reshuffle on every render.
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildLayout(
  memories: Memory[],
  members: Member[],
  names: Record<string, string>,
): TownLayout {
  const colorOf = new Map(members.map((m) => [m.userId, m.colorIndex]));
  const byTime = [...memories].sort(
    (a, b) => a.happenedOn.localeCompare(b.happenedOn) || a.createdAt.localeCompare(b.createdAt),
  );

  // Shared memories: one building per month, oldest month in the center.
  const months = new Map<string, Memory[]>();
  for (const m of byTime.filter((m) => m.kind === "shared")) {
    const key = monthKey(m.happenedOn);
    months.set(key, [...(months.get(key) ?? []), m]);
  }
  const keys = [...months.keys()].sort();
  const first = keys.length ? monthIndex(keys[0]) : 0;
  const buildings: Building[] = keys.map((key) => {
    const list = months.get(key)!;
    return {
      key: `month:${key}`,
      month: key,
      label: shortMonthLabel(key),
      longLabel: longMonthLabel(key),
      name: names[key] ?? null,
      plot: spiral(monthIndex(key) - first),
      floors: list.slice(0, MAX_FLOORS).map((m) => ({
        memoryId: m.id,
        colorIndex: colorOf.get(m.authorId) ?? 0,
      })),
      count: list.length,
    };
  });

  const last = keys.length ? monthIndex(keys[keys.length - 1]) - first : -1;
  const used = new Set(keys.map((k) => monthIndex(k) - first));
  const emptyLots: Plot[] = [];
  for (let i = 0; i <= last; i++) if (!used.has(i)) emptyLots.push(spiral(i));

  const total = memories.length;
  const parks: Plot[] = [];
  let next = last + 1;
  // The town park is there from the start; unlocks add more.
  if (keys.length) parks.push(spiral(next++));
  if (total >= 10) parks.push(spiral(next++));
  if (total >= 30) parks.push(spiral(next++));
  const landmark = total >= 50 ? spiral(next++) : null;

  const occupied = [...buildings.map((b) => b.plot), ...emptyLots, ...parks, ...(landmark ? [landmark] : [])];
  const radius = occupied.reduce((r, p) => Math.max(r, Math.abs(p.x), Math.abs(p.z)), 0);
  const half = (radius + 0.5) * PLOT;
  const taken = new Set(occupied.map((p) => `${p.x},${p.z}`));
  const plazas: Plot[] = [];
  if (buildings.length >= 2)
    for (let x = -radius; x <= radius; x++)
      for (let z = -radius; z <= radius; z++) if (!taken.has(`${x},${z}`)) plazas.push({ x, z });

  // Solo memories: one lodge per friend in the woods around downtown.
  const soloCount = new Map<string, number>();
  for (const m of memories) if (m.kind === "solo") soloCount.set(m.authorId, (soloCount.get(m.authorId) ?? 0) + 1);
  const lodgeRing = half * Math.SQRT2 + PLOT * 1.1;
  const slots = Math.max(4, members.length);
  const lodges: Lodge[] = members
    .filter((m) => soloCount.has(m.userId))
    .map((m) => {
      // Start behind the city (seen from the south-east) so lodges frame the skyline.
      const angle = -Math.PI * 0.75 + (m.colorIndex * 2 * Math.PI) / slots;
      return {
        key: `lodge:${m.userId}`,
        userId: m.userId,
        displayName: m.displayName,
        colorIndex: m.colorIndex,
        x: Math.cos(angle) * lodgeRing,
        z: Math.sin(angle) * lodgeRing,
        angle,
        count: soloCount.get(m.userId)!,
      };
    });

  const inner = half * Math.SQRT2 + PLOT * 0.55;
  const outer = lodgeRing + PLOT * 1.7;

  // Roads out of downtown: a lane to each lodge, and avenues into the woods.
  const roads: Road[] = [];
  if (buildings.length >= 2) {
    for (const l of lodges) {
      const c = Math.cos(l.angle);
      const s = Math.sin(l.angle);
      const t0 = half / Math.max(Math.abs(c), Math.abs(s));
      roads.push({ x1: c * t0, z1: s * t0, x2: c * (lodgeRing - 1), z2: s * (lodgeRing - 1) });
    }
    const far = outer + PLOT * 4;
    const a = PLOT / 2;
    const avenues: Road[] = [
      { x1: a, z1: -half, x2: a, z2: -far },
      { x1: -a, z1: half, x2: -a, z2: far },
      { x1: half, z1: -a, x2: far, z2: -a },
      { x1: -half, z1: a, x2: -far, z2: a },
    ];
    for (const r of avenues) if (!lodges.some((l) => segmentDist(l.x, l.z, r) < 2.6)) roads.push(r);
  }

  // The woods: a loose ring of trees, with clearings for the lodges and roads.
  const rand = rng(7);
  const trees: TownLayout["trees"] = [];
  const target = Math.round(((outer * outer - inner * inner) * Math.PI) / 11);
  for (let tries = 0; trees.length < target && tries < target * 6; tries++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(inner * inner + rand() * (outer * outer - inner * inner));
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (lodges.some((l) => (l.x - x) ** 2 + (l.z - z) ** 2 < 3.2 ** 2)) continue;
    if (roads.some((rd) => segmentDist(x, z, rd) < 1.2)) continue;
    trees.push({ x, z, s: 0.75 + rand() * 0.6 });
  }

  return {
    buildings,
    emptyLots,
    plazas,
    parks,
    landmark,
    radius,
    half,
    streets: buildings.length >= 2,
    // A few cars from the start; the 20-memory unlock adds 3, plus 1 per 10 more, up to 8.
    carCount: (buildings.length >= 2 ? 3 : 0) + (total >= 20 ? Math.min(8, 3 + Math.floor((total - 20) / 10)) : 0),
    streetlights: total >= 30,
    roads,
    lodges,
    lodgeRing,
    outer,
    trees,
    total,
    months: new Set(memories.map((m) => monthKey(m.happenedOn))).size,
  };
}
