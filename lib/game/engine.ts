import { cardValue, createDeck, getPower, rankLabel } from "./cards";
import type {
  CaboState,
  Card,
  CardRef,
  GameAction,
  GameOptions,
  GameState,
  HandCard,
  PendingPower,
  Player,
  PowerKind,
  Rank,
  WinnerSummary,
} from "./types";

export const defaultOptions: GameOptions = {
  includeJokers: false,
  maxPlayers: 4,
};

export const initialGameState: GameState = {
  roomCode: makeRoomCode(),
  phase: "lobby",
  options: defaultOptions,
  players: [],
  deck: [],
  discardPile: [],
  currentPlayerIndex: 0,
  drawnCard: null,
  stackWindow: null,
  pendingPower: null,
  pendingGift: null,
  cabo: null,
  winnerId: null,
  toast: null,
  log: [],
  highlighted: [],
};

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "start-game":
      return startGame(action.playerNames, action.options);
    case "initial-peek":
      return initialPeek(state, action.playerId, action.cardIds);
    case "draw":
      return drawCard(state, action.playerId);
    case "play-drawn":
      return playDrawn(state, action.playerId);
    case "swap-drawn":
      return swapDrawn(state, action.playerId, action.handCardId);
    case "attempt-stack":
      return attemptStack(state, action.playerId, action.target);
    case "give-card":
      return giveCardAfterOpponentStack(state, action.playerId, action.handCardId);
    case "select-power-card":
      return selectPowerCard(state, action.playerId, action.target);
    case "finish-power":
      return finishPower(state, action.playerId);
    case "finish-seen-swap":
      return finishSeenSwap(state, action.playerId, action.shouldSwap);
    case "declare-cabo":
      return declareCabo(state, action.playerId);
    case "dismiss-toast":
      return { ...state, toast: null };
    default:
      return state;
  }
}

export function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function currentPlayer(state: GameState): Player | null {
  return state.players[state.currentPlayerIndex] ?? null;
}

export function playerTotal(player: Player): number {
  return roundTotal(player.hand.reduce((sum, handCard) => sum + cardValue(handCard.card), 0));
}

export function getWinnerSummary(state: GameState): WinnerSummary | null {
  if (!state.winnerId) return null;
  const totals = Object.fromEntries(state.players.map((player) => [player.id, playerTotal(player)]));
  const winner = state.players.find((player) => player.id === state.winnerId);
  return {
    winnerId: state.winnerId,
    totals,
    reason: winner ? `${winner.name} wins with ${totals[winner.id]} points.` : "Game over.",
  };
}

export function canSelectForPower(state: GameState, viewerId: string, ref: CardRef): boolean {
  const pending = state.pendingPower;
  if (!pending || pending.actorId !== viewerId) return false;
  if (pending.kind === "peek-own") return ref.playerId === viewerId;
  if (pending.kind === "peek-other") return ref.playerId !== viewerId;
  if (pending.kind === "blind-swap" || pending.kind === "seen-swap") {
    return canSwapWithPlayer(state, viewerId, ref.playerId);
  }
  return false;
}

function startGame(playerNames: string[], options: GameOptions): GameState {
  const names = playerNames.map((name) => name.trim()).filter(Boolean).slice(0, options.maxPlayers);
  const deck = createDeck(options.includeJokers);
  const players: Player[] = names.map((name, index) => ({
    id: `p${index + 1}`,
    name,
    hand: deck.splice(0, 4).map(toHandCard),
    hasPeekedInitial: false,
    penaltyCount: 0,
  }));

  return {
    ...initialGameState,
    roomCode: makeRoomCode(),
    options,
    players,
    deck,
    phase: "initial-peek",
    log: [`Room created for ${names.length} players.`],
  };
}

function initialPeek(state: GameState, playerId: string, cardIds: string[]): GameState {
  if (state.phase !== "initial-peek") return withToast(state, "Initial peeking is already done.");
  if (cardIds.length !== 2) return withToast(state, "Choose exactly two cards to peek.");

  const player = findPlayer(state, playerId);
  if (!player) return state;
  const selected = new Set(cardIds);
  const valid = player.hand.filter((card) => selected.has(card.id)).length === 2;
  if (!valid) return withToast(state, "Those cards are not in your hand.");

  const players = state.players.map((p) => (p.id === playerId ? { ...p, hasPeekedInitial: true } : p));
  const allReady = players.every((p) => p.hasPeekedInitial);
  return {
    ...state,
    players,
    phase: allReady ? "turn" : "initial-peek",
    highlighted: cardIds.map((handCardId) => ({ playerId, handCardId })),
    toast: allReady ? "All peeks are done. First turn is live." : `${player.name} peeked at two cards.`,
    log: [`${player.name} peeked at two cards.`, ...state.log],
  };
}

function drawCard(state: GameState, playerId: string): GameState {
  if (state.phase !== "turn") return withToast(state, "You cannot draw right now.");
  if (currentPlayer(state)?.id !== playerId) return withToast(state, "It is not your turn.");
  if (state.deck.length === 0) return withToast(state, "The deck is empty.");

  const [drawnCard, ...deck] = state.deck;
  return {
    ...state,
    deck,
    drawnCard,
    stackWindow: null,
    phase: "drawn",
    highlighted: [],
    toast: `${currentPlayer(state)?.name} drew a card.`,
  };
}

function playDrawn(state: GameState, playerId: string): GameState {
  if (state.phase !== "drawn" || !state.drawnCard) return withToast(state, "Draw a card first.");
  if (currentPlayer(state)?.id !== playerId) return withToast(state, "It is not your turn.");

  const card = state.drawnCard;
  const power = getPower(card);
  const base = {
    ...state,
    drawnCard: null,
    discardPile: [card, ...state.discardPile],
    stackWindow: openStackWindow(card),
    toast: `${findPlayer(state, playerId)?.name} played ${rankLabel(card)}.`,
    log: [`${findPlayer(state, playerId)?.name} played ${rankLabel(card)}.`, ...state.log],
  };

  if (!power) return finishTurn(base);
  if (power === "skip") {
    return finishTurn({
      ...base,
      toast: `${rankLabel(card)} skips the next player.`,
      log: [`${rankLabel(card)} skips the next player.`, ...base.log],
    }, 2);
  }
  return {
    ...base,
    phase: "power",
    pendingPower: newPendingPower(playerId, power, card),
  };
}

function swapDrawn(state: GameState, playerId: string, handCardId: string): GameState {
  if (state.phase !== "drawn" || !state.drawnCard) return withToast(state, "Draw a card first.");
  if (currentPlayer(state)?.id !== playerId) return withToast(state, "It is not your turn.");

  const player = findPlayer(state, playerId);
  const handCard = player?.hand.find((card) => card.id === handCardId);
  if (!player || !handCard) return withToast(state, "Choose one of your own cards.");

  const drawn = state.drawnCard;
  const replaced = handCard.card;
  const players = replaceHandCard(state.players, playerId, handCardId, toHandCard(drawn));
  return finishTurn({
    ...state,
    players,
    drawnCard: null,
    discardPile: [replaced, ...state.discardPile],
    stackWindow: openStackWindow(replaced),
    highlighted: [{ playerId, handCardId }],
    toast: `${player.name} swapped into their hand and played ${rankLabel(replaced)}.`,
    log: [`${player.name} swapped into their hand and played ${rankLabel(replaced)}.`, ...state.log],
  });
}

function attemptStack(state: GameState, actorId: string, target: CardRef): GameState {
  if (!state.stackWindow) return withToast(state, "Too late.");
  const actor = findPlayer(state, actorId);
  const targetPlayer = findPlayer(state, target.playerId);
  const targetCard = targetPlayer?.hand.find((card) => card.id === target.handCardId);
  if (!actor || !targetPlayer || !targetCard) return withToast(state, "That card is no longer there.");

  const isCorrect = ranksMatch(targetCard.card.rank, state.stackWindow.rank);
  if (!isCorrect) {
    return drawPenalty({
      ...state,
      stackWindow: null,
      highlighted: [target],
      toast: `${actor.name} guessed wrong and drew a penalty card.`,
      log: [`${actor.name} missed a stack and drew a penalty card.`, ...state.log],
    }, actorId);
  }

  if (target.playerId === actorId) {
    return {
      ...state,
      players: removeHandCard(state.players, actorId, target.handCardId),
      discardPile: [targetCard.card, ...state.discardPile],
      stackWindow: null,
      highlighted: [target],
      toast: `${actor.name} stacked ${rankLabel(targetCard.card)}.`,
      log: [`${actor.name} stacked ${rankLabel(targetCard.card)}.`, ...state.log],
    };
  }

  return {
    ...state,
    players: removeHandCard(state.players, target.playerId, target.handCardId),
    discardPile: [targetCard.card, ...state.discardPile],
    stackWindow: null,
    pendingGift: { actorId, recipientId: target.playerId },
    phase: "gift",
    highlighted: [target],
    toast: `${actor.name} stacked ${targetPlayer.name}'s card. Choose a card to give them.`,
    log: [`${actor.name} stacked ${targetPlayer.name}'s card.`, ...state.log],
  };
}

function giveCardAfterOpponentStack(state: GameState, playerId: string, handCardId: string): GameState {
  if (state.phase !== "gift" || state.pendingGift?.actorId !== playerId) {
    return withToast(state, "You do not have a card to give right now.");
  }
  const actor = findPlayer(state, playerId);
  const gift = actor?.hand.find((card) => card.id === handCardId);
  if (!actor || !gift) return withToast(state, "Choose one of your own cards to give.");

  const recipientId = state.pendingGift.recipientId;
  const players = state.players.map((player) => {
    if (player.id === playerId) return { ...player, hand: player.hand.filter((card) => card.id !== handCardId) };
    if (player.id === recipientId) return { ...player, hand: [...player.hand, gift] };
    return player;
  });

  return {
    ...state,
    players,
    pendingGift: null,
    phase: state.pendingPower ? "power" : "turn",
    highlighted: [{ playerId, handCardId }],
    toast: `${actor.name} gave a card back.`,
  };
}

function selectPowerCard(state: GameState, playerId: string, target: CardRef): GameState {
  const pending = state.pendingPower;
  if (state.phase !== "power" || !pending || pending.actorId !== playerId) {
    return withToast(state, "No power is waiting for you.");
  }
  if (!canSelectForPower(state, playerId, target)) return withToast(state, "That card cannot be selected for this power.");
  if (!findHandCard(state, target)) return withToast(state, "That card is no longer there.");

  if (pending.kind === "peek-own" || pending.kind === "peek-other") {
    return {
      ...state,
      pendingPower: { ...pending, selected: [target], revealedToActor: [target] },
      highlighted: [target],
      toast: "Card peeked. Tap Done when you are ready.",
    };
  }

  const selected = uniqueRefs([...pending.selected, target]);
  const nextPending: PendingPower = {
    ...pending,
    selected,
    revealedToActor: pending.kind === "seen-swap" ? selected : [],
  };

  if (selected.length < 2) {
    return { ...state, pendingPower: nextPending, highlighted: selected, toast: "Choose one more card." };
  }

  if (pending.kind === "blind-swap") {
    return finishTurn({
      ...state,
      players: swapHandCards(state.players, selected[0], selected[1]),
      pendingPower: null,
      highlighted: selected,
      toast: "Blind swap complete.",
      log: [`${findPlayer(state, playerId)?.name} blind-swapped two cards.`, ...state.log],
    });
  }

  return {
    ...state,
    pendingPower: nextPending,
    highlighted: selected,
    toast: "Review the two cards, then swap or cancel.",
  };
}

function finishPower(state: GameState, playerId: string): GameState {
  const pending = state.pendingPower;
  if (state.phase !== "power" || pending?.actorId !== playerId) {
    return withToast(state, "No power is waiting for you.");
  }
  return finishTurn({
    ...state,
    pendingPower: null,
    toast: "Power resolved.",
    log: [`${findPlayer(state, playerId)?.name} resolved ${rankLabel(pending.sourceCard)}.`, ...state.log],
  });
}

function finishSeenSwap(state: GameState, playerId: string, shouldSwap: boolean): GameState {
  const pending = state.pendingPower;
  if (state.phase !== "power" || pending?.actorId !== playerId || pending.kind !== "seen-swap") {
    return withToast(state, "No seen swap is waiting.");
  }
  if (pending.selected.length !== 2) return withToast(state, "Choose two cards first.");

  return finishTurn({
    ...state,
    players: shouldSwap ? swapHandCards(state.players, pending.selected[0], pending.selected[1]) : state.players,
    pendingPower: null,
    highlighted: pending.selected,
    toast: shouldSwap ? "Seen swap complete." : "Seen swap cancelled.",
    log: [`${findPlayer(state, playerId)?.name} ${shouldSwap ? "completed" : "cancelled"} a seen swap.`, ...state.log],
  });
}

function declareCabo(state: GameState, playerId: string): GameState {
  if (state.phase === "game-over") return state;
  const player = findPlayer(state, playerId);
  if (!player) return state;

  const beforeDraw = state.phase === "turn" && currentPlayer(state)?.id === playerId;
  if (beforeDraw) return resolveCabo({ ...state, cabo: { declaredBy: playerId, finalTurnQueue: [] } });

  const queue = nextPlayersAfter(state, playerId).filter((id) => id !== playerId);
  return {
    ...state,
    cabo: { declaredBy: playerId, finalTurnQueue: queue },
    toast: `${player.name} called Cabo. Everyone else gets one final turn.`,
    log: [`${player.name} called Cabo.`, ...state.log],
  };
}

function finishTurn(state: GameState, step = 1): GameState {
  if (state.cabo?.finalTurnQueue.length === 0) return resolveCabo(state);

  let nextIndex = (state.currentPlayerIndex + step) % state.players.length;
  let cabo: CaboState | null = state.cabo;
  if (cabo?.finalTurnQueue.length) {
    const [nextPlayerId, ...rest] = cabo.finalTurnQueue;
    nextIndex = state.players.findIndex((player) => player.id === nextPlayerId);
    cabo = { ...cabo, finalTurnQueue: rest };
    if (rest.length === 0) {
      return resolveCabo({ ...state, cabo });
    }
  }

  return {
    ...state,
    phase: cabo?.finalTurnQueue.length === 0 && state.cabo ? "turn" : "turn",
    pendingPower: null,
    currentPlayerIndex: Math.max(nextIndex, 0),
    cabo,
  };
}

function resolveCabo(state: GameState): GameState {
  const declaredBy = state.cabo?.declaredBy;
  const declarer = declaredBy ? findPlayer(state, declaredBy) : null;
  if (!declarer) return state;

  const totals = state.players.map((player) => ({ player, total: playerTotal(player) }));
  const declarerTotal = playerTotal(declarer);
  const lowest = Math.min(...totals.map((entry) => entry.total));
  const tiedLowest = totals.filter((entry) => entry.total === lowest);
  const declarerWins = declarerTotal <= 5 && declarerTotal === lowest && tiedLowest.length === 1;
  const winner = declarerWins
    ? declarer
    : totals
        .filter((entry) => entry.player.id !== declarer.id)
        .sort((a, b) => a.total - b.total || a.player.name.localeCompare(b.player.name))[0]?.player ?? declarer;

  return {
    ...state,
    phase: "game-over",
    winnerId: winner.id,
    drawnCard: null,
    pendingPower: null,
    pendingGift: null,
    stackWindow: null,
    highlighted: [],
    toast: `${winner.name} wins. ${declarer.name} called Cabo with ${declarerTotal}.`,
    log: [`${winner.name} wins after Cabo.`, ...state.log],
  };
}

function drawPenalty(state: GameState, playerId: string): GameState {
  const [penalty, ...deck] = state.deck;
  if (!penalty) return withToast(state, "No penalty card available.");
  return {
    ...state,
    deck,
    players: state.players.map((player) =>
      player.id === playerId
        ? { ...player, hand: [...player.hand, toHandCard(penalty)], penaltyCount: player.penaltyCount + 1 }
        : player,
    ),
  };
}

function canSwapWithPlayer(state: GameState, actorId: string, targetPlayerId: string): boolean {
  if (actorId === targetPlayerId) return true;
  return state.cabo?.declaredBy !== targetPlayerId;
}

function nextPlayersAfter(state: GameState, playerId: string): string[] {
  const start = state.players.findIndex((player) => player.id === playerId);
  return state.players.slice(start + 1).concat(state.players.slice(0, start)).map((player) => player.id);
}

function openStackWindow(card: Card) {
  return { rank: card.rank, discardCardId: card.id };
}

function newPendingPower(actorId: string, kind: PowerKind, sourceCard: Card): PendingPower {
  return { actorId, kind, sourceCard, selected: [], revealedToActor: [] };
}

function toHandCard(card: Card): HandCard {
  return { id: `hand-${card.id}`, card };
}

function ranksMatch(a: Rank, b: Rank): boolean {
  return a === b;
}

function findPlayer(state: GameState, playerId: string): Player | undefined {
  return state.players.find((player) => player.id === playerId);
}

function findHandCard(state: GameState, ref: CardRef): HandCard | undefined {
  return findPlayer(state, ref.playerId)?.hand.find((card) => card.id === ref.handCardId);
}

function replaceHandCard(players: Player[], playerId: string, handCardId: string, replacement: HandCard): Player[] {
  return players.map((player) =>
    player.id === playerId
      ? { ...player, hand: player.hand.map((card) => (card.id === handCardId ? replacement : card)) }
      : player,
  );
}

function removeHandCard(players: Player[], playerId: string, handCardId: string): Player[] {
  return players.map((player) =>
    player.id === playerId ? { ...player, hand: player.hand.filter((card) => card.id !== handCardId) } : player,
  );
}

function swapHandCards(players: Player[], a: CardRef, b: CardRef): Player[] {
  const first = players.find((player) => player.id === a.playerId)?.hand.find((card) => card.id === a.handCardId);
  const second = players.find((player) => player.id === b.playerId)?.hand.find((card) => card.id === b.handCardId);
  if (!first || !second) return players;

  return players.map((player) => ({
    ...player,
    hand: player.hand.map((card) => {
      if (player.id === a.playerId && card.id === a.handCardId) return second;
      if (player.id === b.playerId && card.id === b.handCardId) return first;
      return card;
    }),
  }));
}

function uniqueRefs(refs: CardRef[]): CardRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.playerId}:${ref.handCardId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function roundTotal(value: number): number {
  return Math.round(value * 10) / 10;
}

function withToast(state: GameState, toast: string): GameState {
  return { ...state, toast };
}
