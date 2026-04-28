import { describe, expect, it } from "vitest";
import { cardValue } from "./cards";
import { gameReducer, initialGameState } from "./engine";
import type { Card, GameState, HandCard, Player } from "./types";

describe("card values", () => {
  it("scores kings and jokers with Cabo rules", () => {
    expect(cardValue(card("K", "spades"))).toBe(0);
    expect(cardValue(card("K", "clubs"))).toBe(0);
    expect(cardValue(card("K", "hearts"))).toBe(13);
    expect(cardValue(card("K", "diamonds"))).toBe(13);
    expect(cardValue(card("JOKER", "joker"))).toBe(-1);
  });
});

describe("stacking", () => {
  it("stacks an opponent card and requires a gift card", () => {
    const state = fixtureState({
      players: [
        player("p1", "You", [card("2", "clubs"), card("3", "clubs")]),
        player("p2", "Maya", [card("K", "spades"), card("4", "clubs")]),
      ],
      stackRank: "K",
    });

    const stacked = gameReducer(state, {
      type: "attempt-stack",
      playerId: "p1",
      target: { playerId: "p2", handCardId: "K-spades" },
    });

    expect(stacked.phase).toBe("gift");
    expect(stacked.pendingGift).toEqual({ actorId: "p1", recipientId: "p2" });
    expect(stacked.players[1].hand.map((handCard) => handCard.card.rank)).toEqual(["4"]);

    const gifted = gameReducer(stacked, { type: "give-card", playerId: "p1", handCardId: "2-clubs" });
    expect(gifted.players[0].hand.map((handCard) => handCard.card.rank)).toEqual(["3"]);
    expect(gifted.players[1].hand.map((handCard) => handCard.card.rank)).toEqual(["4", "2"]);
  });

  it("draws a penalty card when a stack guess is wrong", () => {
    const state = fixtureState({
      deck: [card("A", "hearts")],
      players: [
        player("p1", "You", [card("5", "clubs")]),
        player("p2", "Maya", [card("K", "spades")]),
      ],
      stackRank: "K",
    });

    const next = gameReducer(state, {
      type: "attempt-stack",
      playerId: "p1",
      target: { playerId: "p1", handCardId: "5-clubs" },
    });

    expect(next.players[0].hand.map((handCard) => handCard.card.rank)).toEqual(["5", "A"]);
    expect(next.players[0].penaltyCount).toBe(1);
    expect(next.stackWindow).toBeNull();
  });
});

describe("Cabo", () => {
  it("makes the declarer lose immediately when their total is above five", () => {
    const state = fixtureState({
      players: [
        player("p1", "You", [card("6", "clubs")]),
        player("p2", "Maya", [card("9", "clubs")]),
      ],
    });

    const next = gameReducer(state, { type: "declare-cabo", playerId: "p1" });

    expect(next.phase).toBe("game-over");
    expect(next.winnerId).toBe("p2");
  });
});

function fixtureState({
  deck = [],
  players,
  stackRank,
}: {
  deck?: Card[];
  players: Player[];
  stackRank?: Card["rank"];
}): GameState {
  return {
    ...initialGameState,
    phase: "turn",
    players,
    deck,
    currentPlayerIndex: 0,
    stackWindow: stackRank ? { rank: stackRank, discardCardId: "discard" } : null,
  };
}

function player(id: string, name: string, cards: Card[]): Player {
  return {
    id,
    name,
    hand: cards.map(toHandCard),
    hasPeekedInitial: true,
    penaltyCount: 0,
  };
}

function toHandCard(cardValue: Card): HandCard {
  return { id: `${cardValue.rank}-${cardValue.suit}`, card: cardValue };
}

function card(rank: Card["rank"], suit: Card["suit"]): Card {
  return { id: `${rank}-${suit}-id`, rank, suit };
}
