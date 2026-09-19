export type BracketMatch = {
  // Position within the round, 0-based, before bye matches are dropped.
  slot: number;
  code: string;
  seats: [string | null, string | null];
  next: { round: number; slot: number; seat: 1 | 2 } | null;
};

export type BracketRound = {
  sequence: number;
  name: string;
  matches: BracketMatch[];
};

// Seed positions in a standard bracket: 1 meets the lowest seed, and the top
// two seeds can only meet in the final (size 8: 1 8 4 5 2 7 3 6).
export function seedPositions(size: number): number[] {
  let positions = [1];
  while (positions.length < size) {
    const total = positions.length * 2 + 1;
    positions = positions.flatMap((seed) => [seed, total - seed]);
  }
  return positions;
}

export function roundName(competitors: number) {
  if (competitors === 2) return "Final";
  if (competitors === 4) return "Semi-finals";
  if (competitors === 8) return "Quarter-finals";
  return `Round of ${competitors}`;
}

export function matchCodePrefix(gameName: string) {
  const words = gameName
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "M";
  if (words.length === 1) return words[0].slice(0, 3);
  return words
    .map((word) => (/^\d+$/.test(word) ? word : word[0]))
    .join("")
    .slice(0, 4);
}

// Single elimination for competitors listed best seed first. Byes go to the
// top seeds, so two byes never meet and every first-round match is real. A
// player with a bye is placed straight into their second-round match.
export function buildSingleElimination(
  seededEntryIds: string[],
  prefix: string,
): BracketRound[] {
  const count = seededEntryIds.length;
  if (count < 2) throw new Error("A bracket needs at least two competitors.");
  if (new Set(seededEntryIds).size !== count) {
    throw new Error("A competitor appears twice in the seeding.");
  }

  const size = 2 ** Math.ceil(Math.log2(count));
  const roundCount = Math.log2(size);
  const positions = seedPositions(size);
  const bySeed = (seed: number) =>
    seed <= count ? seededEntryIds[seed - 1] : null;

  const rounds: BracketRound[] = [];
  for (let sequence = 1; sequence <= roundCount; sequence += 1) {
    const matchCount = size / 2 ** sequence;
    rounds.push({
      sequence,
      name: roundName(matchCount * 2),
      matches: Array.from({ length: matchCount }, (_, slot) => ({
        slot,
        code: "",
        seats: [null, null] as [string | null, string | null],
        next:
          sequence < roundCount
            ? {
                round: sequence + 1,
                slot: Math.floor(slot / 2),
                seat: (slot % 2 === 0 ? 1 : 2) as 1 | 2,
              }
            : null,
      })),
    });
  }

  const first = rounds[0];
  first.matches.forEach((match, slot) => {
    match.seats = [
      bySeed(positions[slot * 2]),
      bySeed(positions[slot * 2 + 1]),
    ];
  });

  // Advance bye winners and drop the empty first-round matches.
  if (roundCount > 1) {
    for (const match of first.matches) {
      const [a, b] = match.seats;
      if (a !== null && b !== null) continue;
      const advancing = a ?? b;
      const target = rounds[1].matches[match.next!.slot];
      target.seats[match.next!.seat - 1] = advancing;
    }
    first.matches = first.matches.filter(
      (match) => match.seats[0] !== null && match.seats[1] !== null,
    );
  }

  for (const round of rounds) {
    round.matches.forEach((match, index) => {
      match.code =
        round.matches.length === 1 && round.sequence === roundCount
          ? `${prefix}-F`
          : `${prefix}-R${round.sequence}-${String(index + 1).padStart(2, "0")}`;
    });
  }

  return rounds;
}

// Fisher–Yates with a caller-supplied source so tests can be deterministic.
export function shuffle<T>(
  items: T[],
  random: () => number = Math.random,
): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}
