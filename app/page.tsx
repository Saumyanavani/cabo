"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Flame, RotateCcw, Share2, Trophy } from "lucide-react";
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

  const dispatch = useCallback((action: GameAction) => {
    setState((previous) => {
      const next = gameReducer(previous, action);
      if (next !== previous && next.phase !== "lobby") {
        saveRoomState(next).catch((error) => {
          console.error(error);
        });
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (state.phase === "lobby" || !hasSupabaseConfig()) return;
    const channel = subscribeToRoom(state.roomCode, (nextState) => {
      setState(nextState);
    });
    return () => {
      void unsubscribeFromRoom(channel);
    };
  }, [state.phase, state.roomCode]);

  const viewer = state.players.find((player) => player.id === viewerId);
  const active = currentPlayer(state);
  const winner = getWinnerSummary(state);

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

  if (state.phase === "lobby") {
    return (
      <RoomSetup
        message={lobbyMessage}
        onJoin={async (code) => {
          try {
            const room = await loadRoomState(code);
            if (!room) {
              setLobbyMessage(hasSupabaseConfig() ? "Room not found." : "Supabase env vars are needed for online joining.");
              return;
            }
            setState(room);
            setViewerId(room.players[1]?.id ?? room.players[0]?.id ?? "p1");
            setLobbyMessage(null);
          } catch (error) {
            console.error(error);
            setLobbyMessage("Could not join that room.");
          }
        }}
        onStart={(names, options) => {
          const next = gameReducer(initialGameState, { type: "start-game", playerNames: names, options });
          setState(next);
          saveRoomState(next).catch((error) => {
            console.error(error);
            setLobbyMessage("Room created locally. Add Supabase env vars for online joining.");
          });
          setViewerId("p1");
          setPeekSelection([]);
        }}
        syncAvailable={hasSupabaseConfig()}
      />
    );
  }

  function handleCardClick(player: Player, handCard: HandCard) {
    const ref: CardRef = { playerId: player.id, handCardId: handCard.id };

    if (state.phase === "initial-peek") {
      if (player.id !== viewerId || viewer?.hasPeekedInitial) return;
      setPeekSelection((current) => {
        if (current.includes(handCard.id)) return current.filter((id) => id !== handCard.id);
        if (current.length >= 2) return current;
        return [...current, handCard.id];
      });
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

  return (
    <main className="game-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Room {state.roomCode}</p>
          <h1>CABO</h1>
        </div>
        <div className="top-bar__actions">
          <select aria-label="View as player" onChange={(event) => setViewerId(event.target.value)} value={viewerId}>
            {state.players.map((player) => (
              <option key={player.id} value={player.id}>
                View as {player.name}
              </option>
            ))}
          </select>
          <button
            className="icon-button icon-button--wide"
            onClick={() => navigator.clipboard?.writeText(state.roomCode)}
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
                active={active?.id === player.id}
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
                <PlayingCard label={`${state.deck.length} left`} size="md" />
                <span>Deck</span>
              </div>
              <div>
                <PlayingCard card={state.discardPile[0]} faceUp={Boolean(state.discardPile[0])} label="Top" size="md" />
                <span>Discard</span>
              </div>
            </div>

            {state.drawnCard ? (
              <div className="drawn-card-panel">
                <PlayingCard card={state.drawnCard} faceUp={Boolean(drawnVisible)} label="Drawn" size="lg" />
                {drawnVisible ? <strong>{rankLabel(state.drawnCard)}</strong> : <strong>Card drawn</strong>}
              </div>
            ) : null}

            <StatusBlock
              activeName={active?.name}
              pendingPowerName={pendingPowerName}
              phase={state.phase}
              stackOpen={Boolean(state.stackWindow)}
            />

            <ActionBar
              activeId={active?.id}
              dispatch={dispatch}
              peekSelection={peekSelection}
              setPeekSelection={setPeekSelection}
              state={state}
              viewerId={viewerId}
            />
          </div>
        </section>

        {viewer ? (
          <PlayerHand
            active={active?.id === viewer.id}
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
          {state.cabo ? <span>Cabo called by {state.players.find((p) => p.id === state.cabo?.declaredBy)?.name}</span> : null}
        </div>
      </footer>

      {winner ? <GameOverModal players={state.players} winnerId={winner.winnerId} onRestart={() => location.reload()} /> : null}
    </main>
  );
}

type ActionBarProps = {
  activeId?: string;
  dispatch: React.Dispatch<Parameters<typeof gameReducer>[1]>;
  peekSelection: string[];
  setPeekSelection: (ids: string[]) => void;
  state: Parameters<typeof gameReducer>[0];
  viewerId: string;
};

function ActionBar({ activeId, dispatch, peekSelection, setPeekSelection, state, viewerId }: ActionBarProps) {
  const isActive = activeId === viewerId;
  const pending = state.pendingPower;

  if (state.phase === "initial-peek") {
    const viewer = state.players.find((player) => player.id === viewerId);
    return (
      <div className="action-bar">
        <button
          className="primary-button"
          disabled={viewer?.hasPeekedInitial || peekSelection.length !== 2}
          onClick={() => {
            dispatch({ type: "initial-peek", playerId: viewerId, cardIds: peekSelection });
            setPeekSelection([]);
          }}
          type="button"
        >
          <Eye size={17} />
          Lock peek
        </button>
      </div>
    );
  }

  if (state.phase === "turn") {
    return (
      <div className="action-bar">
        <button className="primary-button" disabled={!isActive} onClick={() => dispatch({ type: "draw", playerId: viewerId })} type="button">
          Draw card
        </button>
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
}: {
  activeName?: string;
  pendingPowerName: string | null;
  phase: string;
  stackOpen: boolean;
}) {
  return (
    <div className="status-block">
      <span>{phaseLabel(phase)}</span>
      <strong>{pendingPowerName ?? (activeName ? `${activeName}'s turn` : "Setting up")}</strong>
      {stackOpen ? <p>Stack is open until the next draw or a correct stack.</p> : <p>Watch the highlighted slots during powers.</p>}
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
