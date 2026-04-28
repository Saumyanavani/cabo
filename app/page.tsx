"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flame, RotateCcw, Share2, Trophy } from "lucide-react";
import { PlayingCard } from "@/components/PlayingCard";
import { PlayerHand } from "@/components/PlayerHand";
import { RoomSetup } from "@/components/RoomSetup";
import { rankLabel } from "@/lib/game/cards";
import {
  canSelectForPower,
  currentPlayer,
  gameReducer,
  getWinnerSummary,
  initialGameState,
  playerTotal,
} from "@/lib/game/engine";
import {
  hasSupabaseConfig,
  loadRoomState,
  saveRoomState,
  subscribeToRoom,
  unsubscribeFromRoom,
} from "@/lib/room/supabaseRoom";
import type { CardRef, GameAction, GameState, HandCard, Player } from "@/lib/game/types";

export default function Home() {
  const [state, setState] = useState<GameState>(initialGameState);
  const [viewerId, setViewerId] = useState("p1");
  const [peekSelection, setPeekSelection] = useState<string[]>([]);
  const [lobbyMessage, setLobbyMessage] = useState<string | null>(null);
  const [roomMessage, setRoomMessage] = useState<string | null>(null);
  const peekLockTimeoutRef = useRef<number | null>(null);

  const dispatch = useCallback((action: GameAction) => {
    setState((previous) => {
      const next = gameReducer(previous, action);
      if (next !== previous && next.players.length > 0) {
        saveRoomState(next).catch((error) => {
          console.error(error);
          setRoomMessage(`Could not sync room: ${formatError(error)}`);
        });
      }
      return next;
    });
  }, []);

  const clearPendingPeekLock = useCallback(() => {
    if (peekLockTimeoutRef.current === null) return;
    window.clearTimeout(peekLockTimeoutRef.current);
    peekLockTimeoutRef.current = null;
  }, []);

  const scheduleInitialPeekLock = useCallback(
    (cardIds: string[]) => {
      clearPendingPeekLock();
      peekLockTimeoutRef.current = window.setTimeout(() => {
        dispatch({ type: "initial-peek", playerId: viewerId, cardIds });
        setPeekSelection([]);
        peekLockTimeoutRef.current = null;
      }, 1700);
    },
    [clearPendingPeekLock, dispatch, viewerId],
  );

  useEffect(() => clearPendingPeekLock, [clearPendingPeekLock]);

  useEffect(() => {
    if (state.players.length === 0 || !hasSupabaseConfig()) return;
    const channel = subscribeToRoom(state.roomCode, (nextState) => {
      setState(nextState);
    });
    return () => {
      void unsubscribeFromRoom(channel);
    };
  }, [state.players.length, state.roomCode]);

  useEffect(() => {
    if (!state.highlighted.length) return;
    const timeout = window.setTimeout(() => {
      dispatch({ type: "clear-highlights" });
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [dispatch, state.highlighted]);

  useEffect(() => {
    const currentViewer = state.players.find((player) => player.id === viewerId);
    if (state.phase === "initial-peek" && !currentViewer?.hasPeekedInitial) return;
    clearPendingPeekLock();
    setPeekSelection([]);
  }, [clearPendingPeekLock, state.phase, state.players, viewerId]);

  const viewer = state.players.find((player) => player.id === viewerId);
  const active = currentPlayer(state);
  const winner = getWinnerSummary(state);
  const initialPeekPending = state.phase === "initial-peek" ? state.players.filter((player) => !player.hasPeekedInitial) : [];
  const initialPeekStatus =
    state.phase === "initial-peek"
      ? viewer?.hasPeekedInitial
        ? initialPeekPending.length
          ? `Waiting for ${initialPeekPending.map((player) => player.name).join(", ")}`
          : "Starting game"
        : "Pick two cards to peek"
      : undefined;

  const revealMap = useMemo(() => {
    const map = new Map<string, string[]>();
    if (state.phase === "initial-peek") map.set(viewerId, peekSelection);
    if (state.pendingPower?.actorId === viewerId) {
      for (const ref of state.pendingPower.revealedToActor) {
        map.set(ref.playerId, [...(map.get(ref.playerId) ?? []), ref.handCardId]);
      }
    }
    if (state.phase === "game-over") {
      for (const player of state.players) map.set(player.id, player.hand.map((card) => card.id));
    }
    return map;
  }, [peekSelection, state.pendingPower, state.phase, state.players, viewerId]);

  if (state.phase === "lobby" && state.players.length === 0) {
    return (
      <RoomSetup
        message={lobbyMessage}
        onCreate={async (nickname, options) => {
          const playerId = makeClientPlayerId();
          const next = gameReducer(initialGameState, { type: "create-room", playerId, name: nickname, options });
          setState(next);
          setViewerId(playerId);
          setPeekSelection([]);
          setRoomMessage(hasSupabaseConfig() ? "Saving room online..." : "Room created locally. Supabase env vars are needed for online joining.");
          try {
            await saveRoomState(next);
            const savedRoom = await loadRoomState(next.roomCode);
            if (!savedRoom) throw new Error("room was not readable after saving; check the rooms table RLS policies");
            setRoomMessage(hasSupabaseConfig() ? "Room is online. Share the code to invite someone." : null);
          } catch (error) {
            console.error(error);
            setRoomMessage(`Room created locally, but online sync failed: ${formatError(error)}`);
          }
        }}
        onJoin={async (code, nickname) => {
          try {
            const room = await loadRoomState(code);
            if (!room) {
              setLobbyMessage(hasSupabaseConfig() ? `Room ${code.trim().toUpperCase()} was not found. Make sure the host sees "Room is online."` : "Supabase env vars are needed for online joining.");
              return;
            }
            const playerId = makeClientPlayerId();
            const joined = gameReducer(room, { type: "join-room", playerId, name: nickname });
            const didJoin = joined.players.some((player) => player.id === playerId);
            if (!didJoin) {
              setLobbyMessage(joined.toast ?? "Could not join that room.");
              return;
            }
            setState(joined);
            setViewerId(playerId);
            await saveRoomState(joined);
            setLobbyMessage(null);
          } catch (error) {
            console.error(error);
            setLobbyMessage(`Could not join: ${formatError(error)}`);
          }
        }}
        syncAvailable={hasSupabaseConfig()}
      />
    );
  }

  if (state.phase === "lobby") {
    return (
      <WaitingRoom
        dispatch={dispatch}
        message={roomMessage ?? state.toast}
        onCopyCode={async () => setRoomMessage(await copyText(state.roomCode, "Room code copied."))}
        state={state}
        viewerId={viewerId}
      />
    );
  }

  function handleCardClick(player: Player, handCard: HandCard) {
    const ref: CardRef = { playerId: player.id, handCardId: handCard.id };

    if (state.phase === "initial-peek") {
      if (player.id !== viewerId || viewer?.hasPeekedInitial) return;
      if (peekLockTimeoutRef.current !== null) return;
      const nextSelection = peekSelection.includes(handCard.id)
        ? peekSelection.filter((id) => id !== handCard.id)
        : peekSelection.length >= 2
          ? peekSelection
          : [...peekSelection, handCard.id];
      setPeekSelection(nextSelection);
      dispatch({
        type: "preview-highlight",
        refs: nextSelection.map((handCardId) => ({ playerId: viewerId, handCardId })),
      });
      if (nextSelection.length === 2) scheduleInitialPeekLock(nextSelection);
      return;
    }

    if (state.phase === "gift" && state.pendingGift?.actorId === viewerId && player.id === viewerId) {
      dispatch({ type: "give-card", playerId: viewerId, handCardId: handCard.id });
      return;
    }

    if (state.phase === "drawn" && active?.id === viewerId && player.id === viewerId) {
      dispatch({ type: "swap-drawn", playerId: viewerId, handCardId: handCard.id });
      return;
    }

    if (state.phase === "power" && state.pendingPower?.actorId === viewerId && canSelectForPower(state, viewerId, ref)) {
      dispatch({ type: "select-power-card", playerId: viewerId, target: ref });
      return;
    }

    if (state.stackWindow) {
      dispatch({ type: "attempt-stack", playerId: viewerId, target: ref });
    }
  }

  const pendingPowerName = state.pendingPower ? powerCopy(state.pendingPower.kind) : null;
  const drawnVisible = state.drawnCard && active?.id === viewerId;
  const canDrawFromDeck = state.phase === "turn" && active?.id === viewerId && state.deck.length > 0;

  return (
    <main className="game-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Room {state.roomCode}</p>
          <h1>CABO</h1>
        </div>
        <div className="top-bar__actions">
          <span className="identity-pill">{viewer?.name ?? "Spectator"}</span>
          <span className="code-pill" aria-label={`Room code ${state.roomCode}`}>
            {state.roomCode}
          </span>
          <button
            className="icon-button icon-button--wide"
            onClick={async () => setRoomMessage(await copyText(state.roomCode, "Room code copied."))}
            type="button"
          >
            <Share2 size={17} />
            Code
          </button>
        </div>
      </header>

      <section className="table-grid">
        <aside className="opponent-grid">
          {state.players
            .filter((player) => player.id !== viewerId)
            .map((player) => (
              <PlayerHand
                active={state.phase === "initial-peek" ? !player.hasPeekedInitial : active?.id === player.id}
                highlighted={state.highlighted}
                key={player.id}
                onCardClick={(card) => handleCardClick(player, card)}
                player={player}
                revealIds={revealMap.get(player.id)}
                selectedIds={state.pendingPower?.selected.map((ref) => ref.handCardId)}
                stackWindowOpen={Boolean(state.stackWindow)}
                viewerId={viewerId}
              />
            ))}
        </aside>

        <section className="table-center" aria-label="Game table">
          <div className="felt-panel">
            <div className="deck-row">
              <div>
                <PlayingCard
                  ariaLabel={canDrawFromDeck ? "Draw from deck" : "Deck"}
                  onClick={canDrawFromDeck ? () => dispatch({ type: "draw", playerId: viewerId }) : undefined}
                  size="md"
                />
                <span>{state.deck.length} left</span>
              </div>
              <div>
                <PlayingCard
                  ariaLabel={state.discardPile[0] ? `Discard pile ${rankLabel(state.discardPile[0])}` : "Discard pile"}
                  card={state.discardPile[0]}
                  faceUp={Boolean(state.discardPile[0])}
                  size="md"
                />
                <span>Discard</span>
              </div>
            </div>

            {state.drawnCard ? (
              <div className="drawn-card-panel">
                <PlayingCard
                  ariaLabel="Drawn card"
                  card={state.drawnCard}
                  faceUp={Boolean(drawnVisible)}
                  size="lg"
                />
                {drawnVisible ? <strong>{rankLabel(state.drawnCard)}</strong> : <strong>Card drawn</strong>}
              </div>
            ) : null}

            <StatusBlock
              activeName={active?.name}
              pendingPowerName={pendingPowerName}
              phase={state.phase}
              stackOpen={Boolean(state.stackWindow)}
              titleOverride={initialPeekStatus}
            />

            <ActionBar
              activeId={active?.id}
              dispatch={dispatch}
              peekSelection={peekSelection}
              state={state}
              viewerId={viewerId}
            />
          </div>
        </section>

        {viewer ? (
          <PlayerHand
            active={state.phase === "initial-peek" ? !viewer.hasPeekedInitial : active?.id === viewer.id}
            highlighted={state.highlighted}
            onCardClick={(card) => handleCardClick(viewer, card)}
            player={viewer}
            revealIds={revealMap.get(viewer.id)}
            selectedIds={[...peekSelection, ...(state.pendingPower?.selected.map((ref) => ref.handCardId) ?? [])]}
            stackWindowOpen={Boolean(state.stackWindow)}
            viewerId={viewerId}
          />
        ) : null}
      </section>

      <footer className="footer-panel">
        <button className="danger-button" onClick={() => dispatch({ type: "declare-cabo", playerId: viewerId })} type="button">
          <Flame size={17} />
          Cabo
        </button>
        <div className="footer-panel__text">
          {state.toast ? <p>{state.toast}</p> : <p>Tap a card during the stack window to attempt a stack.</p>}
          {roomMessage ? <span>{roomMessage}</span> : null}
          {state.cabo ? <span>Cabo called by {state.players.find((p) => p.id === state.cabo?.declaredBy)?.name}</span> : null}
        </div>
      </footer>

      {winner ? <GameOverModal players={state.players} winnerId={winner.winnerId} onRestart={() => location.reload()} /> : null}
    </main>
  );
}

function WaitingRoom({
  dispatch,
  message,
  onCopyCode,
  state,
  viewerId,
}: {
  dispatch: React.Dispatch<GameAction>;
  message?: string | null;
  onCopyCode: () => void;
  state: GameState;
  viewerId: string;
}) {
  const viewer = state.players.find((player) => player.id === viewerId);
  const isHost = state.hostId === viewerId;

  return (
    <main className="waiting-shell">
      <section className="waiting-panel">
        <div className="waiting-panel__header">
          <div>
            <p className="eyebrow">Room {state.roomCode}</p>
            <h1>CABO</h1>
          </div>
          <button className="icon-button icon-button--wide" onClick={onCopyCode} type="button">
            <Share2 size={17} />
            Code
          </button>
        </div>

        <button className="room-code-card" onClick={onCopyCode} type="button">
          <span>Room code</span>
          <strong>{state.roomCode}</strong>
          <em>Tap to copy</em>
        </button>

        <div className="seat-list">
          {state.players.map((player, index) => (
            <div className="seat-row" key={player.id}>
              <span>Seat {index + 1}</span>
              <strong>{player.name}</strong>
              {player.id === state.hostId ? <em>Host</em> : null}
              {player.id === viewerId ? <em>You</em> : null}
            </div>
          ))}
          {Array.from({ length: state.options.maxPlayers - state.players.length }).map((_, index) => (
            <div className="seat-row seat-row--empty" key={index}>
              <span>Open</span>
              <strong>Waiting</strong>
            </div>
          ))}
        </div>

        <div className="waiting-panel__footer">
          <p>
            {viewer
              ? "Share the room code. Players join by nickname, then the host starts the deal."
              : "You are viewing this room without a seat."}
          </p>
          <button
            className="primary-button"
            disabled={!isHost || state.players.length < 2}
            onClick={() => dispatch({ type: "start-room-game", playerId: viewerId })}
            type="button"
          >
            Start game
          </button>
        </div>
        {message ? <p className="room-message">{message}</p> : null}
      </section>
    </main>
  );
}

type ActionBarProps = {
  activeId?: string;
  dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]>;
  peekSelection: string[];
  state: Parameters<typeof gameReducer>[0];
  viewerId: string;
};

function ActionBar({ activeId, dispatch, peekSelection, state, viewerId }: ActionBarProps) {
  const isActive = activeId === viewerId;
  const pending = state.pendingPower;

  if (state.phase === "initial-peek") {
    const viewer = state.players.find((player) => player.id === viewerId);
    const pendingPlayers = state.players.filter((player) => !player.hasPeekedInitial);
    const pendingNames = pendingPlayers.map((player) => player.name).join(", ");
    const remaining = 2 - peekSelection.length;
    return (
      <div className="action-bar">
        {viewer?.hasPeekedInitial ? (
          <p>{pendingNames ? `Waiting for ${pendingNames}.` : "Starting the first turn."}</p>
        ) : peekSelection.length === 2 ? (
          <p>Cards flip back automatically.</p>
        ) : (
          <p>{remaining === 2 ? "Tap two cards." : "Tap one more card."}</p>
        )}
      </div>
    );
  }

  if (state.phase === "turn") {
    return (
      <div className="action-bar">
        <p>{isActive ? "Tap the deck to draw." : "Waiting for the active player."}</p>
      </div>
    );
  }

  if (state.phase === "drawn") {
    return (
      <div className="action-bar action-bar--split">
        <button className="primary-button" disabled={!isActive} onClick={() => dispatch({ type: "play-drawn", playerId: viewerId })} type="button">
          Play drawn
        </button>
        <p>Or tap one of your larger hand cards to swap.</p>
      </div>
    );
  }

  if (state.phase === "power" && pending?.actorId === viewerId) {
    const canFinishPeek =
      (pending.kind === "peek-own" || pending.kind === "peek-other") && pending.revealedToActor.length === 1;
    const canFinishSeen = pending.kind === "seen-swap" && pending.selected.length === 2;
    return (
      <div className="action-bar action-bar--split">
        {canFinishPeek ? (
          <button className="primary-button" onClick={() => dispatch({ type: "finish-power", playerId: viewerId })} type="button">
            Done
          </button>
        ) : null}
        {canFinishSeen ? (
          <>
            <button className="primary-button" onClick={() => dispatch({ type: "finish-seen-swap", playerId: viewerId, shouldSwap: true })} type="button">
              Swap
            </button>
            <button className="ghost-button" onClick={() => dispatch({ type: "finish-seen-swap", playerId: viewerId, shouldSwap: false })} type="button">
              Cancel
            </button>
          </>
        ) : null}
        {!canFinishPeek && !canFinishSeen ? <p>{powerInstruction(pending.kind)}</p> : null}
      </div>
    );
  }

  if (state.phase === "gift" && state.pendingGift?.actorId === viewerId) {
    return (
      <div className="action-bar">
        <p>Tap one of your cards to give it to the player you stacked.</p>
      </div>
    );
  }

  return <div className="action-bar"><p>Waiting for the active player.</p></div>;
}

function StatusBlock({
  activeName,
  pendingPowerName,
  phase,
  stackOpen,
  titleOverride,
}: {
  activeName?: string;
  pendingPowerName: string | null;
  phase: string;
  stackOpen: boolean;
  titleOverride?: string;
}) {
  return (
    <div className="status-block">
      <span>{phaseLabel(phase)}</span>
      <strong>{titleOverride ?? pendingPowerName ?? (activeName ? `${activeName}'s turn` : "Setting up")}</strong>
      {stackOpen ? <p>Stack is open.</p> : null}
    </div>
  );
}

function GameOverModal({ players, winnerId, onRestart }: { players: Player[]; winnerId: string; onRestart: () => void }) {
  const winner = players.find((player) => player.id === winnerId);
  return (
    <div className="modal-backdrop">
      <section className="game-over-modal">
        <Trophy size={28} />
        <h2>{winner?.name} wins</h2>
        <div className="score-list">
          {players.map((player) => (
            <div key={player.id}>
              <span>{player.name}</span>
              <strong>{playerTotal(player)}</strong>
            </div>
          ))}
        </div>
        <button className="primary-button" onClick={onRestart} type="button">
          <RotateCcw size={17} />
          New room
        </button>
      </section>
    </div>
  );
}

function phaseLabel(phase: string): string {
  return {
    "initial-peek": "Initial peek",
    turn: "Turn",
    drawn: "Drawn card",
    power: "Power",
    gift: "Gift card",
    "game-over": "Game over",
  }[phase] ?? "Lobby";
}

function powerCopy(kind: string): string {
  return {
    "peek-own": "Peek at one of your cards",
    "peek-other": "Peek at someone else's card",
    "blind-swap": "Blind swap",
    "seen-swap": "Seen swap",
    skip: "Skip",
  }[kind] ?? "Power";
}

function powerInstruction(kind: string): string {
  return {
    "peek-own": "Tap one of your own cards.",
    "peek-other": "Tap another player's card.",
    "blind-swap": "Tap two cards to swap without seeing them.",
    "seen-swap": "Tap two cards, review them, then choose swap or cancel.",
  }[kind] ?? "Resolve the power.";
}

function makeClientPlayerId(): string {
  return `p-${crypto.randomUUID()}`;
}

async function copyText(text: string, successMessage: string): Promise<string> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return successMessage;
    }

    const input = document.createElement("input");
    input.value = text;
    input.readOnly = true;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(input);
    return copied ? successMessage : `Copy failed. Code: ${text}`;
  } catch {
    return `Copy failed. Code: ${text}`;
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String(error.message);
  return "check Supabase settings";
}
