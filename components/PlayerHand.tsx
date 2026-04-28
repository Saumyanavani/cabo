"use client";

import clsx from "clsx";
import { PlayingCard } from "@/components/PlayingCard";
import type { CardRef, HandCard, Player } from "@/lib/game/types";

type PlayerHandProps = {
  player: Player;
  viewerId: string;
  active?: boolean;
  stackWindowOpen?: boolean;
  highlighted?: CardRef[];
  selectedIds?: string[];
  revealIds?: string[];
  onCardClick?: (handCard: HandCard) => void;
};

export function PlayerHand({
  player,
  viewerId,
  active = false,
  stackWindowOpen = false,
  highlighted = [],
  selectedIds = [],
  revealIds = [],
  onCardClick,
}: PlayerHandProps) {
  const isViewer = player.id === viewerId;

  return (
    <section className={clsx("player-hand", active && "player-hand--active", isViewer && "player-hand--viewer")}>
      <div className="player-hand__meta">
        <div>
          <h2>{player.name}</h2>
          <p>{active ? "Turn" : isViewer ? "You" : "Opponent"}</p>
        </div>
        <span>{player.hand.length} cards</span>
      </div>
      <div className="player-hand__cards">
        {player.hand.map((handCard, index) => {
          const ref = { playerId: player.id, handCardId: handCard.id };
          const isHighlighted = highlighted.some(
            (item) => item.playerId === ref.playerId && item.handCardId === ref.handCardId,
          );
          const isSelected = selectedIds.includes(handCard.id);
          const faceUp = revealIds.includes(handCard.id);

          return (
            <PlayingCard
              card={handCard.card}
              faceUp={faceUp}
              highlighted={isHighlighted}
              key={handCard.id}
              label={`Slot ${index + 1}`}
              onClick={onCardClick ? () => onCardClick(handCard) : undefined}
              selected={isSelected}
              size={isViewer ? "lg" : "md"}
            />
          );
        })}
      </div>
      {stackWindowOpen ? <p className="player-hand__hint">Tap any matching slot to stack.</p> : null}
    </section>
  );
}
