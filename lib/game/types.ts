export type Suit = "clubs" | "spades" | "hearts" | "diamonds" | "joker";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "JOKER";

export type GamePhase =
  | "lobby"
  | "initial-peek"
  | "turn"
  | "drawn"
  | "power"
  | "gift"
  | "game-over";

export type PowerKind = "peek-own" | "peek-other" | "skip" | "blind-swap" | "seen-swap";

export type Card = {
  id: string;
  rank: Rank;
  suit: Suit;
};

export type HandCard = {
  id: string;
  card: Card;
};

export type Player = {
  id: string;
  name: string;
  hand: HandCard[];
  hasPeekedInitial: boolean;
  penaltyCount: number;
};

export type CardRef = {
  playerId: string;
  handCardId: string;
};

export type StackWindow = {
  rank: Rank;
  discardCardId: string;
  message?: string;
};

export type PendingPower = {
  actorId: string;
  kind: PowerKind;
  sourceCard: Card;
  selected: CardRef[];
  revealedToActor: CardRef[];
};

export type PendingGift = {
  actorId: string;
  recipientId: string;
};

export type CaboState = {
  declaredBy: string;
  finalTurnQueue: string[];
};

export type GameOptions = {
  includeJokers: boolean;
  maxPlayers: number;
};

export type GameState = {
  roomCode: string;
  phase: GamePhase;
  options: GameOptions;
  hostId: string | null;
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  currentPlayerIndex: number;
  drawnCard: Card | null;
  stackWindow: StackWindow | null;
  pendingPower: PendingPower | null;
  pendingGift: PendingGift | null;
  cabo: CaboState | null;
  winnerId: string | null;
  toast: string | null;
  log: string[];
  highlighted: CardRef[];
};

export type GameAction =
  | { type: "create-room"; playerId: string; name: string; options: GameOptions }
  | { type: "join-room"; playerId: string; name: string }
  | { type: "leave-room"; playerId: string }
  | { type: "start-room-game"; playerId: string }
  | { type: "start-game"; playerNames: string[]; options: GameOptions }
  | { type: "preview-highlight"; refs: CardRef[] }
  | { type: "clear-highlights" }
  | { type: "initial-peek"; playerId: string; cardIds: string[] }
  | { type: "draw"; playerId: string }
  | { type: "play-drawn"; playerId: string }
  | { type: "swap-drawn"; playerId: string; handCardId: string }
  | { type: "attempt-stack"; playerId: string; target: CardRef }
  | { type: "give-card"; playerId: string; handCardId: string }
  | { type: "select-power-card"; playerId: string; target: CardRef }
  | { type: "finish-power"; playerId: string }
  | { type: "finish-seen-swap"; playerId: string; shouldSwap: boolean }
  | { type: "declare-cabo"; playerId: string }
  | { type: "dismiss-toast" };

export type WinnerSummary = {
  winnerId: string;
  totals: Record<string, number>;
  reason: string;
};
