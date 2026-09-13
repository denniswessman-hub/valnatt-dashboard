import type { DashboardResult, DistrictResult } from './types';

// Valmyndighetens vallokaler.json, kontrollerad 2026-09-13.
// https://data.val.se/filer/val2026/rostmottagning/vallokaler.json
export const bengtsforsDistricts: DistrictResult[] = [
  ['0101', 'Nordvästra'], ['0102', 'Norra'], ['0613', 'Nordöstra'],
  ['0616', 'Sydöstra'], ['0919', 'Sydvästra'],
].map(([code, name]) => ({ code, name, reported: false, votesTotal: 0, parties: [] }));

export const waitingResults: DashboardResult = {
  source: 'Inväntar Valmyndigheten', election: 'Kommunfullmäktige 2026',
  status: 'preliminar', lastCheckedAt: '2026-09-13T00:00:00Z', lastChangedAt: null,
  municipalities: [{ code: '1460', name: 'Bengtsfors', districtsReported: 0,
    districtsTotal: 5, votesTotal: 0, parties: [], districts: bengtsforsDistricts }],
};
