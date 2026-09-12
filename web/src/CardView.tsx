import type { TabCard } from "./types";

interface Props {
  card: TabCard;
  selected?: boolean;
  used?: boolean;
  disabled?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

const TYPE_ICONS = { GRIND: "⚙️", SOCIAL: "💬", BRAINROT: "🌀", UTILITY: "🧰" };

export function CardView({ card, selected, used, disabled, compact, onClick }: Props) {
  return (
    <button
      type="button"
      className={`game-card type-${card.type.toLowerCase()} rarity-${card.rarity.toLowerCase()} ${selected ? "selected" : ""} ${used ? "used" : ""} ${compact ? "compact" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <div className="card-topline">
        <span>{card.rarity}</span>
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
        </>
      )}
      {used && <span className="used-stamp">USED</span>}
    </button>
  );
}
