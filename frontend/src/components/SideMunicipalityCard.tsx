import type { MunicipalityResult } from "../types";

const numberFormatter = new Intl.NumberFormat("sv-SE");

type SideMunicipalityCardProps = {
  municipality: MunicipalityResult;
};

export function SideMunicipalityCard({ municipality }: SideMunicipalityCardProps) {
  const titleId = `side-municipality-${municipality.code}-title`;
  const reportingPercent = municipality.districtsTotal > 0
    ? Math.round((municipality.districtsReported / municipality.districtsTotal) * 100)
    : 0;

  return (
    <article className="municipality-card" aria-labelledby={titleId}>
      <div className="card-heading">
        <div>
          <p className="eyebrow">Kommun</p>
          <h3 id={titleId}>{municipality.name}</h3>
        </div>
        <strong aria-label={`${reportingPercent} procent räknat`}>
          {reportingPercent}%
        </strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`Räknade valdistrikt i ${municipality.name}`}
        aria-valuemin={0}
        aria-valuemax={municipality.districtsTotal}
        aria-valuenow={municipality.districtsReported}
        aria-valuetext={`${municipality.districtsReported} av ${municipality.districtsTotal} valdistrikt`}
      >
        <span style={{ width: `${reportingPercent}%` }} />
      </div>
      <dl className="card-metrics">
        <div>
          <dt>Valdistrikt</dt>
          <dd>
            {municipality.districtsReported} av {municipality.districtsTotal}
          </dd>
        </div>
        <div>
          <dt>Röster</dt>
          <dd>{numberFormatter.format(municipality.votesTotal)}</dd>
        </div>
      </dl>
    </article>
  );
}
