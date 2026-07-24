// The 2026 Tour de France stage list.
//
// Source of truth: the official route, https://www.letour.fr/en/overall-route
// (types, distances, start/finish towns and dates taken from there).
//
// Each stage links to its official letour.fr page (interactive map + elevation
// profile). `vvRouteId` is an optional VeloViewer route ID for an inline 3D
// embed — VeloViewer IDs are opaque with no public lookup, so fill them in by
// hand (open the route on veloviewer.com → "Embed" → copy the number from
// https://veloviewer.com/routes/<vvRouteId>/embed2). `SAMPLE_ROUTE_ID` is a
// verified real stage route used to demonstrate the VeloViewer embed.

const SAMPLE_ROUTE_ID = "3376150526098738236"; // TdF 2025 Stage 3 (Dunkerque)

// Official 2026 route assets from letour.fr / ASO.
const OFFICIAL_ROUTE_MAP =
  "https://img.aso.fr/core_app/img-cycling-tdf-jpg/tdf26-aff-400x600-parcours-uk-sans-logo-bd/70922/0:0,1890:2312-1200-0-70/cb112";
const OFFICIAL_ROUTE_PDF =
  "https://storage-aso.lequipe.fr/ASO/cycling_tdf/tdf2026-parcours.pdf";

const S = (n) => `https://www.letour.fr/en/stage-${n}`;

const STAGES = [
  { n: 1, date: "2026-07-04", from: "Barcelona", to: "Barcelona", type: "Team time trial", km: 19.6, letourUrl: S(1), vvRouteId: null },
  { n: 2, date: "2026-07-05", from: "Tarragona", to: "Barcelona", type: "Hilly", km: 168.5, letourUrl: S(2), vvRouteId: null },
  { n: 3, date: "2026-07-06", from: "Granollers", to: "Les Angles", type: "Mountain", km: 195.9, letourUrl: S(3), vvRouteId: null },
  { n: 4, date: "2026-07-07", from: "Carcassonne", to: "Foix", type: "Hilly", km: 181.9, letourUrl: S(4), vvRouteId: null },
  { n: 5, date: "2026-07-08", from: "Lannemezan", to: "Pau", type: "Flat", km: 158.3, letourUrl: S(5), vvRouteId: null },
  { n: 6, date: "2026-07-09", from: "Pau", to: "Gavarnie-Gèdre", type: "Mountain", km: 186.2, letourUrl: S(6), vvRouteId: null },
  { n: 7, date: "2026-07-10", from: "Hagetmau", to: "Bordeaux", type: "Flat", km: 175.1, letourUrl: S(7), vvRouteId: null },
  { n: 8, date: "2026-07-11", from: "Périgueux", to: "Bergerac", type: "Flat", km: 180.4, letourUrl: S(8), vvRouteId: null },
  { n: 9, date: "2026-07-12", from: "Malemort", to: "Ussel", type: "Hilly", km: 154.6, letourUrl: S(9), vvRouteId: null },
  { n: 10, date: "2026-07-14", from: "Aurillac", to: "Le Lioran", type: "Mountain", km: 166.6, letourUrl: S(10), vvRouteId: null },
  { n: 11, date: "2026-07-15", from: "Vichy", to: "Nevers", type: "Flat", km: 161.3, letourUrl: S(11), vvRouteId: null },
  { n: 12, date: "2026-07-16", from: "Circuit Nevers Magny-Cours", to: "Chalon-sur-Saône", type: "Flat", km: 179.1, letourUrl: S(12), vvRouteId: null },
  { n: 13, date: "2026-07-17", from: "Dole", to: "Belfort", type: "Hilly", km: 205.8, letourUrl: S(13), vvRouteId: null },
  { n: 14, date: "2026-07-18", from: "Mulhouse", to: "Le Markstein Fellering", type: "Mountain", km: 155.3, letourUrl: S(14), vvRouteId: null },
  { n: 15, date: "2026-07-19", from: "Champagnole", to: "Plateau de Solaison", type: "Mountain", km: 183.9, letourUrl: S(15), vvRouteId: null },
  { n: 16, date: "2026-07-21", from: "Évian-les-Bains", to: "Thonon-les-Bains", type: "Individual time trial", km: 26.1, letourUrl: S(16), vvRouteId: null },
  { n: 17, date: "2026-07-22", from: "Chambéry", to: "Voiron", type: "Flat", km: 174.7, letourUrl: S(17), vvRouteId: null },
  { n: 18, date: "2026-07-23", from: "Voiron", to: "Orcières-Merlette", type: "Mountain", km: 185.2, letourUrl: S(18), vvRouteId: null },
  { n: 19, date: "2026-07-24", from: "Gap", to: "Alpe d'Huez", type: "Mountain", km: 127.9, letourUrl: S(19), vvRouteId: null },
  { n: 20, date: "2026-07-25", from: "Le Bourg d'Oisans", to: "Alpe d'Huez", type: "Mountain", km: 170.9, letourUrl: S(20), vvRouteId: null },
  { n: 21, date: "2026-07-26", from: "Thoiry", to: "Paris (Champs-Élysées)", type: "Flat", km: 132.5, letourUrl: S(21), vvRouteId: null },
];

// Compact route summary for the LLM's context.
function stagesSummary() {
  return STAGES.map(
    (s) => `Stage ${s.n} (${s.date}): ${s.from} → ${s.to} — ${s.km} km [${s.type}]`
  ).join("\n");
}

module.exports = {
  STAGES,
  SAMPLE_ROUTE_ID,
  OFFICIAL_ROUTE_MAP,
  OFFICIAL_ROUTE_PDF,
  stagesSummary,
};
