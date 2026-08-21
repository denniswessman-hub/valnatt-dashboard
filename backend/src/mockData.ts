import type { DashboardResult } from "./types";

// Avsiktligt identisk med frontendens testdata tills API-kopplingen byggs i steg 7.
export const mockResults: DashboardResult = {
  source: "Påhittad demodata",
  election: "Kommunfullmäktige 2026",
  status: "test",
  lastCheckedAt: "2026-08-21T20:45:00+02:00",
  lastChangedAt: null,
  municipalities: [
    {
      code: "1460",
      name: "Bengtsfors",
      districtsReported: 8,
      districtsTotal: 12,
      votesTotal: 4_231,
      parties: [
        { code: "S", name: "Socialdemokraterna", votes: 1_142, percent: 27.0, color: "#e94b55" },
        { code: "M", name: "Moderaterna", votes: 866, percent: 20.5, color: "#48a4ea" },
        { code: "SD", name: "Sverigedemokraterna", votes: 741, percent: 17.5, color: "#f2c94c" },
        { code: "C", name: "Centerpartiet", votes: 593, percent: 14.0, color: "#58b87b" },
        { code: "Ö", name: "Övriga partier", votes: 889, percent: 21.0, color: "#9aa7a3" },
      ],
    },
    {
      code: "1492",
      name: "Åmål",
      districtsReported: 7,
      districtsTotal: 14,
      votesTotal: 3_986,
      parties: [
        { code: "S", name: "Socialdemokraterna", votes: 1_315, percent: 33.0, color: "#e94b55" },
        { code: "M", name: "Moderaterna", votes: 877, percent: 22.0, color: "#48a4ea" },
        { code: "SD", name: "Sverigedemokraterna", votes: 718, percent: 18.0, color: "#f2c94c" },
        { code: "Ö", name: "Övriga partier", votes: 1_076, percent: 27.0, color: "#9aa7a3" },
      ],
    },
    {
      code: "1461",
      name: "Mellerud",
      districtsReported: 5,
      districtsTotal: 11,
      votesTotal: 2_755,
      parties: [
        { code: "S", name: "Socialdemokraterna", votes: 716, percent: 26.0, color: "#e94b55" },
        { code: "M", name: "Moderaterna", votes: 620, percent: 22.5, color: "#48a4ea" },
        { code: "SD", name: "Sverigedemokraterna", votes: 565, percent: 20.5, color: "#f2c94c" },
        { code: "Ö", name: "Övriga partier", votes: 854, percent: 31.0, color: "#9aa7a3" },
      ],
    },
    {
      code: "1438",
      name: "Dals-Ed",
      districtsReported: 3,
      districtsTotal: 7,
      votesTotal: 1_441,
      parties: [
        { code: "S", name: "Socialdemokraterna", votes: 389, percent: 27.0, color: "#e94b55" },
        { code: "M", name: "Moderaterna", votes: 317, percent: 22.0, color: "#48a4ea" },
        { code: "SD", name: "Sverigedemokraterna", votes: 274, percent: 19.0, color: "#f2c94c" },
        { code: "Ö", name: "Övriga partier", votes: 461, percent: 32.0, color: "#9aa7a3" },
      ],
    },
  ],
};
