import type { DashboardResult, MunicipalityResult } from "../types";
import { PartyBar } from "./PartyBar";

const numberFormatter = new Intl.NumberFormat("sv-SE");

type MainMunicipalityProps = {
  municipality: MunicipalityResult;
  status: DashboardResult["status"];
};

const statusLabels: Record<DashboardResult["status"], string> = {
  test: "Preliminär testvy",
  preliminar: "Preliminärt resultat",
  slutlig: "Slutligt resultat",
};

export function MainMunicipality({ municipality, status }: MainMunicipalityProps) {
  const titleId = `municipality-${municipality.code}-title`;
  const reportingPercent = Math.round(
    (municipality.districtsReported / municipality.districtsTotal) * 100,
  );

  return (
    <section className="main-panel" aria-labelledby={titleId}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Huvudkommun</p>
          <h1 id={titleId}>{municipality.name}</h1>
        </div>
        <div className="counted-badge">
          <strong>
            {municipality.districtsReported}/{municipality.districtsTotal}
          </strong>
          <span>valdistrikt räknade</span>
        </div>
      </div>

      <div className="hero-metrics">
        <div>
          <span>Räknade röster</span>
          <strong>{numberFormatter.format(municipality.votesTotal)}</strong>
        </div>
        <div>
          <span>Räkningsgrad</span>
          <strong>{reportingPercent}%</strong>
        </div>
      </div>

      <div className="table-heading">
        <h2>Partier</h2>
        <span>{statusLabels[status]}</span>
      </div>
      <div className="party-results">
        {municipality.parties.map((party) => (
          <PartyBar key={party.code} party={party} />
        ))}
      </div>
    </section>
  );
}
