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
  const glyph = card ? suitGlyph(card.suit) : "";
  const isRoyal = card ? ["J", "Q", "K"].includes(card.rank) : false;

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
          <span className="playing-card__corner playing-card__corner--top">
            <b>{card.rank === "JOKER" ? "Jkr" : card.rank}</b>
            <i>{glyph}</i>
          </span>
          <span className="playing-card__art" aria-hidden="true">
            {card.rank === "JOKER" ? (
              <>
                <span className="playing-card__joker-star">✦</span>
                <span className="playing-card__joker-word">Joker</span>
              </>
            ) : isRoyal ? (
              <>
                <span className="playing-card__royal">{card.rank}</span>
                <span className="playing-card__royal-suit">{glyph}</span>
              </>
            ) : (
              <>
                <span>{glyph}</span>
                <span>{glyph}</span>
                <span>{glyph}</span>
              </>
            )}
          </span>
          <span className="playing-card__corner playing-card__corner--bottom">
            <b>{card.rank === "JOKER" ? "Jkr" : card.rank}</b>
            <i>{glyph}</i>
          </span>
          <span className="playing-card__center">{rankLabel(card)}</span>
        </>
      ) : (
        <>
          <span className="playing-card__back-line" />
          <span className="playing-card__back-diamond" />
          <span className="playing-card__back-mark">C</span>
          <span className="playing-card__back-mini">CABO</span>
        </>
      )}
      {label ? <span className="playing-card__label">{label}</span> : null}
    </button>
  );
}
