import type { Card } from "./types";

const RANK_NAMES: Record<number, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

const SUIT_SYMBOLS: Record<Card["suit"], string> = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
};

export function formatCard(card: Card): string {
  return `${RANK_NAMES[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

export function isRed(card: Card): boolean {
  return card.suit === "hearts" || card.suit === "diamonds";
}

export function cardsToCode(cards: Card[]): string[] {
  const symbols: Record<Card["suit"], string> = {
    clubs: "c",
    diamonds: "d",
    hearts: "h",
    spades: "s",
  };
  return cards.map((card) => `${RANK_NAMES[card.rank]}${symbols[card.suit]}`);
}
