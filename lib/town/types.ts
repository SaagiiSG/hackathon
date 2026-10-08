export type MemoryKind = "shared" | "solo";

export type Member = {
  userId: string;
  displayName: string;
  joinedAt: string;
  // Position in join order; picks the friend's color from FRIEND_COLORS.
  colorIndex: number;
};

export type Memory = {
  id: string;
  authorId: string;
  kind: MemoryKind;
  title: string;
  body: string | null;
  photoUrl: string | null;
  happenedOn: string; // YYYY-MM-DD
  createdAt: string;
};

export type Town = {
  id: string;
  name: string;
  inviteCode: string;
  members: Member[];
  memories: Memory[];
  // Month key ("2026-07") → the name someone gave that month's skyscraper.
  buildingNames: Record<string, string>;
};

export type Viewer = { id: string; email: string };

export type TownState =
  | { kind: "onboarding"; viewer: Viewer; suggestedName: string }
  | { kind: "town"; viewer: Viewer; town: Town };

export type NewMemory = {
  kind: MemoryKind;
  title: string;
  body: string | null;
  photo: File | null;
  happenedOn: string;
};
