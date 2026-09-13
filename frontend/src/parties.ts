import type { PartyResult } from "./types";

// Valmyndighetens fullständiga partibeteckningar är långa. Kortformen används
// i listan; det fullständiga namnet finns kvar i aria-label.
const displayNames: Record<string, string> = {
  "Arbetarepartiet-Socialdemokraterna": "Socialdemokraterna",
  "Liberalerna (tidigare Folkpartiet)": "Liberalerna",
  "Miljöpartiet de gröna": "Miljöpartiet",
};

export function partyDisplayName(party: PartyResult): string {
  return displayNames[party.name] ?? party.name;
}

// Störst först. "Övriga partier" ligger alltid sist.
export function sortPartiesByVotes(parties: PartyResult[]): PartyResult[] {
  return [...parties].sort((a, b) => {
    if (a.code === "ÖVR") return 1;
    if (b.code === "ÖVR") return -1;
    return b.votes - a.votes || a.code.localeCompare(b.code, "sv");
  });
}
