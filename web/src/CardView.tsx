import { useState } from "react";
import type { TabCard } from "./types";

interface Props {
  card: TabCard;
  selected?: boolean;
  used?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

const TYPE_ICONS = { ENTERTAINMENT: "🎮", UTILITY: "🧰", ACADEMIC: "🎓", SHOPPING: "🛒" };

export function CardView({ card, selected, used, disabled, compact, onClick }: Props) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`game-card type-${card.type.toLowerCase()} ${selected ? "selected" : ""} ${used ? "used" : ""} ${compact ? "compact" : ""}`}
        disabled={disabled}
        onClick={onClick ?? (compact ? () => setExpanded(true) : undefined)}
      >
        <div className="card-topline">
          <span>{TYPE_ICONS[card.type]} {card.type}</span>
        </div>
        <div className="card-title-row">
          {card.faviconUrl ? <img src={card.faviconUrl} alt="" /> : <span className="favicon-fallback">◈</span>}
          <div>
            <strong>{card.cardName}</strong>
            <small>{card.domain}</small>
          </div>
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
        {used && <span className="used-stamp">USED</span>}
        {compact && !onClick && <span className="inspect-hint">VIEW STATS</span>}
      </button>
      {expanded && (
        <div className="modal-backdrop" role="presentation" onClick={() => setExpanded(false)}>
          <div className="card-modal" role="dialog" aria-modal="true" aria-label={`${card.cardName} details`} onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setExpanded(false)}>×</button>
            <CardView card={card} used={used} disabled />
          </div>
        </div>
      )}
    </>
  );
}
