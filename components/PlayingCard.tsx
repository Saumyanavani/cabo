"use client";

import clsx from "clsx";
import { isRed, rankLabel, suitGlyph } from "@/lib/game/cards";
import type { Card } from "@/lib/game/types";

type PlayingCardProps = {
  card?: Card;
  faceUp?: boolean;
  highlighted?: boolean;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
};

export function PlayingCard({
  card,
  faceUp = false,
  highlighted = false,
  selected = false,
  disabled = false,
  label,
  size = "lg",
  onClick,
}: PlayingCardProps) {
  const clickable = Boolean(onClick) && !disabled;

  return (
    <button
      className={clsx(
        "playing-card",
        `playing-card--${size}`,
        faceUp && "playing-card--face-up",
        card && faceUp && isRed(card) && "playing-card--red",
        highlighted && "playing-card--highlighted",
        selected && "playing-card--selected",
        clickable && "playing-card--clickable",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {faceUp && card ? (
        <>
          <span className="playing-card__rank">{card.rank === "JOKER" ? "J" : card.rank}</span>
          <span className="playing-card__suit">{suitGlyph(card.suit)}</span>
          <span className="playing-card__center">{rankLabel(card)}</span>
        </>
      ) : (
        <>
          <span className="playing-card__back-mark">C</span>
          <span className="playing-card__back-line" />
        </>
      )}
      {label ? <span className="playing-card__label">{label}</span> : null}
    </button>
  );
}
