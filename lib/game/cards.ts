import type { Card, PowerKind, Rank, Suit } from "./types";

const suits: Suit[] = ["clubs", "spades", "hearts", "diamonds"];
const ranks: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export function createDeck(includeJokers: boolean): Card[] {
  const deck = suits.flatMap((suit) =>
    ranks.map((rank) => ({
      id: `${rank}-${suit}-${crypto.randomUUID()}`,
      rank,
      suit,
    })),
  );

  if (includeJokers) {
    deck.push(
      { id: `JOKER-a-${crypto.randomUUID()}`, rank: "JOKER", suit: "joker" },
      { id: `JOKER-b-${crypto.randomUUID()}`, rank: "JOKER", suit: "joker" },
    );
  }

  return shuffle(deck);
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function cardValue(card: Card): number {
  if (card.rank === "JOKER") return -1;
  if (card.rank === "A") return 1;
  if (card.rank === "J") return 11;
  if (card.rank === "Q") return 12;
  if (card.rank === "K") return card.suit === "clubs" || card.suit === "spades" ? 0 : 13;
  return Number(card.rank);
}

export function getPower(card: Card): PowerKind | null {
  if (card.rank === "7" || card.rank === "8") return "peek-own";
  if (card.rank === "9" || card.rank === "10") return "peek-other";
  if (card.rank === "J") return "skip";
  if (card.rank === "Q") return "blind-swap";
  if (card.rank === "K") return "seen-swap";
  return null;
}

export function rankLabel(card: Card): string {
  if (card.rank === "JOKER") return "Joker";
  return `${card.rank}${suitGlyph(card.suit)}`;
}

export function suitGlyph(suit: Suit): string {
  return {
    clubs: "♣",
    spades: "♠",
    hearts: "♥",
    diamonds: "♦",
    joker: "★",
  }[suit];
}

export function isRed(card: Card): boolean {
  return card.suit === "hearts" || card.suit === "diamonds";
}
