import type { PartyResult } from "../types";

const numberFormatter = new Intl.NumberFormat("sv-SE");
const percentFormatter = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type PartyBarProps = {
  party: PartyResult;
};

export function PartyBar({ party }: PartyBarProps) {
  const safePercent = Math.min(100, Math.max(0, party.percent));
  const formattedPercent = percentFormatter.format(safePercent);

  return (
    <article
      className="party-bar"
      aria-label={`${party.name}: ${numberFormatter.format(party.votes)} röster, ${formattedPercent} procent`}
    >
      <div className="party-bar__heading">
        <div className="party-bar__identity">
          <span
            className="party-bar__code"
            style={{ backgroundColor: party.color }}
            aria-hidden="true"
          >
            {party.code}
          </span>
          <span className="party-bar__name">{party.name}</span>
        </div>
        <div className="party-bar__numbers">
          <span>
            <strong>{numberFormatter.format(party.votes)}</strong>
            <small>röster</small>
          </span>
          <strong className="party-bar__percent">{formattedPercent}%</strong>
        </div>
      </div>
      <div
        className="party-bar__track"
        role="progressbar"
        aria-label={`Röstandel för ${party.name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={safePercent}
        aria-valuetext={`${formattedPercent} procent`}
      >
        <span
          className="party-bar__fill"
          style={{ backgroundColor: party.color, width: `${safePercent}%` }}
        />
      </div>
    </article>
  );
}
