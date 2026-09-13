import type { PartyResult } from "../types";
import { partyDisplayName } from "../parties";

const numberFormatter = new Intl.NumberFormat("sv-SE");
const percentFormatter = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const changeFormatter = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

type PartyBarProps = {
  party: PartyResult;
};

export function PartyBar({ party }: PartyBarProps) {
  const safePercent = Math.min(100, Math.max(0, party.percent));
  const formattedPercent = percentFormatter.format(safePercent);
  const change = typeof party.changePercent === "number" ? party.changePercent : null;
  const changeLabel = change === null ? null : changeFormatter.format(change);

  return (
    <article
      className="party-bar"
      aria-label={`${party.name}: ${numberFormatter.format(party.votes)} röster, ${formattedPercent} procent${changeLabel ? `, ${changeLabel} procentenheter sedan 2022` : ""}`}
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
          <span className="party-bar__name">{partyDisplayName(party)}</span>
        </div>
        <div className="party-bar__numbers">
          <span>
            <strong>{numberFormatter.format(party.votes)}</strong>
            <small>röster</small>
          </span>
          {changeLabel && (
            <span
              className={`party-bar__change party-bar__change--${change! > 0 ? "up" : change! < 0 ? "down" : "flat"}`}
              title="Förändring i procentenheter jämfört med valet 2022"
            >
              <strong>{changeLabel}</strong>
              <small>vs 2022</small>
            </span>
          )}
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
