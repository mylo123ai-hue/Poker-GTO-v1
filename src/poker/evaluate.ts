import type { Card } from "./types";

export type HandCategory =
  | "high card"
  | "one pair"
  | "two pair"
  | "three of a kind"
  | "straight"
  | "flush"
  | "full house"
  | "four of a kind"
  | "straight flush";

export type HandValue = { rank: number[]; category: HandCategory };

const CATEGORY_NAMES: HandCategory[] = [
  "high card",
  "one pair",
  "two pair",
  "three of a kind",
  "straight",
  "flush",
  "full house",
  "four of a kind",
  "straight flush",
];

function straightHigh(ranks: number[]): number {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique[0] === 14) unique.push(1);
  let run = 1;
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index - 1]! - unique[index]! === 1) {
      run += 1;
      if (run === 5) return unique[index - 4]!;
    } else {
      run = 1;
    }
  }
  return 0;
}

function evaluateFive(cards: Card[]): HandValue {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const isFlush = cards.every((card) => card.suit === cards[0]!.suit);
  const straight = straightHigh(ranks);
  if (isFlush && straight) return { rank: [8, straight], category: CATEGORY_NAMES[8]! };
  if (groups[0]![1] === 4) {
    return { rank: [7, groups[0]![0], groups[1]![0]], category: CATEGORY_NAMES[7]! };
  }
  if (groups[0]![1] === 3 && groups[1]![1] === 2) {
    return { rank: [6, groups[0]![0], groups[1]![0]], category: CATEGORY_NAMES[6]! };
  }
  if (isFlush) return { rank: [5, ...ranks], category: CATEGORY_NAMES[5]! };
  if (straight) return { rank: [4, straight], category: CATEGORY_NAMES[4]! };
  if (groups[0]![1] === 3) {
    const kickers = groups.slice(1).map(([rank]) => rank).sort((a, b) => b - a);
    return { rank: [3, groups[0]![0], ...kickers], category: CATEGORY_NAMES[3]! };
  }
  const pairs = groups.filter(([, count]) => count === 2).map(([rank]) => rank).sort((a, b) => b - a);
  if (pairs.length === 2) {
    const kicker = groups.find(([, count]) => count === 1)![0];
    return { rank: [2, pairs[0]!, pairs[1]!, kicker], category: CATEGORY_NAMES[2]! };
  }
  if (pairs.length === 1) {
    const kickers = groups.filter(([, count]) => count === 1).map(([rank]) => rank).sort((a, b) => b - a);
    return { rank: [1, pairs[0]!, ...kickers], category: CATEGORY_NAMES[1]! };
  }
  return { rank: [0, ...ranks], category: CATEGORY_NAMES[0]! };
}

function compareRank(a: number[], b: number[]): number {
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference > 0 ? 1 : -1;
  }
  return 0;
}

export function evaluateBest(cards: Card[]): HandValue {
  if (cards.length < 5 || cards.length > 7) {
    throw new RangeError(`Expected five to seven cards, received ${cards.length}.`);
  }
  let best: HandValue | null = null;
  const selected: Card[] = [];
  const visit = (start: number) => {
    if (selected.length === 5) {
      const value = evaluateFive(selected);
      if (!best || compareRank(value.rank, best.rank) > 0) best = value;
      return;
    }
    for (let index = start; index <= cards.length - (5 - selected.length); index += 1) {
      selected.push(cards[index]!);
      visit(index + 1);
      selected.pop();
    }
  };
  visit(0);
  return best!;
}

export function compareHands(first: Card[], second: Card[]): number {
  return compareRank(evaluateBest(first).rank, evaluateBest(second).rank);
}
