import { createDeck } from "./random";
import { createRng } from "./random";
import { compareHands } from "./evaluate";
import type { Card } from "./types";

function cardKey(card: Card): string {
  return `${card.rank}:${card.suit}`;
}

export type EquityEstimate = {
  equity: number;
  wins: number;
  ties: number;
  samples: number;
  opponentModel: "uniform random legal hand";
};

export function estimateEquity(
  ownCards: Card[],
  board: Card[],
  samples = 96,
  seed: string | number = "equity",
): EquityEstimate {
  if (ownCards.length !== 2 || board.length > 5 || samples < 1) {
    throw new RangeError("Equity estimation expects two private cards, up to five board cards, and at least one sample.");
  }
  const known = new Set([...ownCards, ...board].map(cardKey));
  if (known.size !== ownCards.length + board.length) throw new Error("Known cards must be distinct.");
  const available = createDeck().filter((card) => !known.has(cardKey(card)));
  const missingBoard = 5 - board.length;
  const rng = createRng(`${seed}:uniform-opponent-equity`);
  let wins = 0;
  let ties = 0;
  for (let sample = 0; sample < samples; sample += 1) {
    const pool = [...available];
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(rng() * (index + 1));
      [pool[index], pool[swapIndex]] = [pool[swapIndex]!, pool[index]!];
    }
    const opponentCards = pool.slice(0, 2);
    const finalBoard = [...board, ...pool.slice(2, 2 + missingBoard)];
    const result = compareHands([...ownCards, ...finalBoard], [...opponentCards, ...finalBoard]);
    if (result > 0) wins += 1;
    else if (result === 0) ties += 1;
  }
  return {
    equity: (wins + ties / 2) / samples,
    wins,
    ties,
    samples,
    opponentModel: "uniform random legal hand",
  };
}
