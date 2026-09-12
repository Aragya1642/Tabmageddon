import { useState } from "react";
import type { CardType, TabCard } from "./types";

interface Props {
  card: TabCard;
  selected?: boolean;
  used?: boolean;
  disabled?: boolean;
  compact?: boolean;
  preview?: boolean;
  popup?: string;
  hit?: boolean;
  flyIn?: boolean;
  onClick?: () => void;
}

const TYPE_ICONS = { ENTERTAINMENT: "▶", UTILITY: "⬡", ACADEMIC: "▣", SHOPPING: "◇" };

function shorten(value: string, max = 22): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function TypeWatermark({ type }: { type: CardType }) {
  return (
    <svg className={`card-watermark type-${type.toLowerCase()}`} viewBox="0 0 64 64" aria-hidden>
      {type === "ENTERTAINMENT" && (
        <>
          <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M26 18v28l22-14z" fill="currentColor" />
        </>
      )}
      {type === "UTILITY" && (
        <>
          <circle cx="32" cy="32" r="10" fill="none" stroke="currentColor" strokeWidth="4" />
          <path d="M30 6h4l2 8 8-3 3 3-3 8 8 2v4l-8 2 3 8-3 3-8-3-2 8h-4l-2-8-8 3-3-3 3-8-8-2v-4l8-2-3-8 3-3 8 3z" fill="currentColor" />
          <circle cx="32" cy="32" r="6" fill="#0f1711" />
        </>
      )}
      {type === "ACADEMIC" && (
        <path d="M32 10 8 22l24 12 24-12zm-18 16v14c6 6 12 8 18 12 6-4 12-6 18-12V26L32 36z" fill="currentColor" />
      )}
      {type === "SHOPPING" && (
        <path d="M20 16h24l6 10v26H14V26zm8 0c0-5 2.5-8 4-8s4 3 4 8" fill="currentColor" />
      )}
    </svg>
  );
}

export function CardView({ card, selected, used, disabled, compact, preview, popup, hit, flyIn, onClick }: Props) {
  const [expanded, setExpanded] = useState(false);
  const forgedLogo = card.sourceType === "synthetic" || !card.faviconUrl;
  return (
    <>
      <button
        type="button"
        className={`game-card type-${card.type.toLowerCase()} ${selected ? "selected" : ""} ${used ? "used" : ""} ${compact ? "compact" : ""} ${preview ? "preview" : ""} ${hit ? "card-hit" : ""} ${flyIn ? "card-fly" : ""}`}
        disabled={disabled && !preview}
        onClick={onClick ?? (compact ? () => setExpanded(true) : undefined)}
      >
        <div className="card-inner">
          <TypeWatermark type={card.type} />
          <div className="card-topline">
            <span className="card-type-icon">{TYPE_ICONS[card.type]}</span>
            <span className="card-type-label">{card.type}</span>
          </div>
          <div className="card-art">
            {forgedLogo ? <span className="favicon-fallback tm-mark">TM</span> : <img src={card.faviconUrl} alt="" />}
          </div>
          <div className="card-title-row">
            <strong title={card.cardName}>{shorten(card.cardName, compact ? 18 : 26)}</strong>
            <small title={card.domain}>{shorten(card.domain, 20)}</small>
          </div>
          {!compact && (
            <>
              <div className="stats">
                <span>RAM <b>{card.stats.ram}</b></span>
                <span>USELESS <b>{card.stats.uselessness}</b></span>
                <span>SHADY <b>{card.stats.shadiness}</b></span>
                <span>AURA <b>{card.stats.aura}</b></span>
              </div>
              <div className="ability">
                <strong>{card.abilityName}</strong>
                <span>{card.abilityDescription}</span>
              </div>
              <p className="roast">“{card.roast}”</p>
              <small className="single-use">SINGLE USE{card.sourceType === "synthetic" ? " · FORGED" : ""}</small>
            </>
          )}
        </div>
        {popup && <span className={`score-popup ${popup.startsWith("-") ? "bad" : "good"}`}>{popup}</span>}
        {hit && <span className="sabotage-arrow" aria-hidden>➤</span>}
        {used && <span className="used-stamp">USED</span>}
        {compact && !onClick && <span className="inspect-hint">VIEW STATS</span>}
      </button>
      {expanded && (
        <div className="modal-backdrop" role="presentation" onClick={() => setExpanded(false)}>
          <div className="card-modal" role="dialog" aria-modal="true" aria-label={`${card.cardName} details`} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setExpanded(false)}>×</button>
            <CardView card={card} used={used} preview />
          </div>
        </div>
      )}
    </>
  );
}
