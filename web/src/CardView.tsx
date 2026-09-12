import { useState } from "react";
import type { TabCard } from "./types";

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

const TYPE_ICONS = { ENTERTAINMENT: "🎮", UTILITY: "🧰", ACADEMIC: "🎓", SHOPPING: "🛒" };
const TYPE_CARVINGS = { ENTERTAINMENT: "🎬", UTILITY: "⚙️", ACADEMIC: "📜", SHOPPING: "🏷️" };

function shorten(value: string, max = 22): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function CardView({ card, selected, used, disabled, compact, preview, popup, hit, flyIn, onClick }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`game-card type-${card.type.toLowerCase()} ${selected ? "selected" : ""} ${used ? "used" : ""} ${compact ? "compact" : ""} ${preview ? "preview" : ""} ${hit ? "card-hit" : ""} ${flyIn ? "card-fly" : ""}`}
        disabled={disabled && !preview}
        onClick={onClick ?? (compact || preview ? () => setExpanded(true) : undefined)}
      >
        <div className="card-inner">
          <div className="card-topline">
            <span className="card-type-icon">{TYPE_ICONS[card.type]}</span>
            <span className="card-type-label">{card.type}</span>
          </div>
          <div className="card-art">
            {card.faviconUrl ? <img src={card.faviconUrl} alt="" /> : <span className="favicon-fallback">◈</span>}
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
          <div className="card-carving" aria-hidden>{TYPE_CARVINGS[card.type]}</div>
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
