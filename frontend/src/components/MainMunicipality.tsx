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
    municipality.districtsTotal ? (municipality.districtsReported / municipality.districtsTotal) * 100 : 0,
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
          <strong>{municipality.districtsReported ? numberFormatter.format(municipality.votesTotal) : '—'}</strong>
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
        {municipality.parties.length === 0 && <p>Inväntar rapporterade röster för Bengtsfors kommun.</p>}
        {municipality.parties.map((party) => (
          <PartyBar key={party.code} party={party} />
        ))}
      </div>
      <section className="district-results" aria-labelledby="district-heading">
        <h2 id="district-heading">Alla valdistrikt i Bengtsfors</h2>
        <p>Öppna ett distrikt för röster och procent per parti. Kommunens total ovan hämtas separat från Valmyndigheten.</p>
        {municipality.districts?.map(district => (
          <details key={district.code} className="district-card">
            <summary><strong>{district.name}</strong><span>{district.reported ? `${numberFormatter.format(district.votesTotal)} röster · Rapporterat` : 'Inväntar rapport'}</span></summary>
            <p>Distriktskod {district.code}</p>
            {district.reported ? district.parties.map(party => <PartyBar key={party.code} party={party} />)
              : <p>Inga resultat har rapporterats för distriktet ännu.</p>}
          </details>
        ))}
      </section>
    </section>
  );
}
