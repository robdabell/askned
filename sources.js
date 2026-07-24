// Curated cycling news & data sources.
//
// Transcribed from the user-supplied cycling_news_sources.yaml (kept as plain
// JS so the app stays dependency-free — no YAML parser needed). These are
// surfaced in the app UI (the "Latest sources" panel) and injected into Ned's
// context so he can point people to the best place for the very latest info
// (live standings, breaking news) when he doesn't hold a fact himself. The
// app's own live context is fetched from Wikipedia + the official site
// (see race-context.js); these links cover everything beyond that.

const SOURCE_GROUPS = [
  {
    category: "Dedicated cycling media",
    sources: [
      { name: "Cyclingnews", url: "https://www.cyclingnews.com", focus: "Comprehensive race coverage, live tickers, results, tech", coverage: "All major races including Tour de France, Giro, Vuelta" },
      { name: "VeloNews (Velo)", url: "https://velo.outsideonline.com", focus: "Race analysis, US perspective, gear reviews", coverage: "Grand Tours, Classics, gravel" },
      { name: "CyclingWeekly", url: "https://www.cyclingweekly.com", focus: "UK-centric news, race reports, fitness", coverage: "WorldTour races, British cycling scene" },
      { name: "Rouleur", url: "https://www.rouleur.cc", focus: "Long-form journalism, culture, photography", coverage: "Feature-led Grand Tour and Classics coverage" },
      { name: "Escape Collective", url: "https://escapecollective.com", focus: "Independent, member-funded journalism and podcasts", coverage: "Deep analysis of pro racing" },
      { name: "CyclingUpToDate", url: "https://www.cyclinguptodate.com", focus: "Fast-turnaround news, transfer rumours", coverage: "Daily pro cycling news" },
      { name: "Wielerflits", url: "https://www.wielerflits.nl", focus: "Dutch-language, strong on transfers and startlists", coverage: "Benelux and WorldTour racing" },
      { name: "GCN (Global Cycling Network)", url: "https://www.globalcyclingnetwork.com", focus: "Video-first content, race analysis, how-tos, tech; major YouTube presence", coverage: "Grand Tours, Classics, general cycling culture", note: "GCN+ streaming closed in 2023; live race streaming moved to Discovery+/TNT Sports in most regions" },
    ],
  },
  {
    category: "Official race sources",
    sources: [
      { name: "Tour de France (official)", url: "https://www.letour.fr", focus: "Official routes, startlists, standings, live tracking", coverage: "Tour de France" },
      { name: "Giro d'Italia (official)", url: "https://www.giroditalia.it", focus: "Official race information", coverage: "Giro d'Italia" },
      { name: "La Vuelta (official)", url: "https://www.lavuelta.es", focus: "Official race information", coverage: "Vuelta a España" },
      { name: "UCI", url: "https://www.uci.org", focus: "Governing body, calendars, rankings, regulations", coverage: "All UCI-sanctioned races" },
    ],
  },
  {
    category: "Results & data",
    sources: [
      { name: "ProCyclingStats", url: "https://www.procyclingstats.com", focus: "Results database, rider stats, startlists, race previews", coverage: "Every professional race; excellent for structured data" },
      { name: "FirstCycling", url: "https://firstcycling.com", focus: "Results, statistics, race history", coverage: "Men's and women's pro racing" },
      { name: "la Flamme Rouge", url: "https://www.la-flamme-rouge.eu", focus: "Route profiles and stage maps", coverage: "Route detail for major races" },
      { name: "VeloViewer", url: "https://veloviewer.com", focus: "Strava-linked analytics, segment explorer, climb data, activity stats", coverage: "Personal ride data and segments rather than pro race news", note: "More an athlete analytics tool than a news source, but useful for exploring Tour de France climbs and segments" },
    ],
  },
  {
    category: "Broadcasters & live coverage",
    sources: [
      { name: "Eurosport / TNT Sports", url: "https://www.eurosport.com/cycling", focus: "Live broadcast, highlights, news (UK/Europe)", coverage: "Grand Tours, Monuments, WorldTour" },
      { name: "FloBikes", url: "https://www.flobikes.com", focus: "Live streaming (North America/Canada)", coverage: "Classics, Grand Tours (region-dependent)" },
      { name: "ITV Sport / ITVX", url: "https://www.itv.com", focus: "Free-to-air Tour de France highlights (UK)", coverage: "Tour de France", note: "UK rights arrangements change periodically — verify current season" },
    ],
  },
  {
    category: "Podcasts & community",
    sources: [
      { name: "The Cycling Podcast", url: "https://thecyclingpodcast.com", focus: "Daily episodes during Grand Tours", coverage: "Tour de France, Giro, Vuelta" },
      { name: "Lanterne Rouge", url: "https://www.lanternerouge.com", focus: "Tactical and data-driven race analysis (YouTube/podcast)", coverage: "All major races" },
      { name: "r/peloton", url: "https://www.reddit.com/r/peloton", focus: "Community discussion, live race threads, breaking news", coverage: "All professional road racing" },
    ],
  },
];

// Compact, grouped list for the LLM's context.
function sourcesSummary() {
  return SOURCE_GROUPS.map(
    (g) =>
      `${g.category}:\n` +
      g.sources.map((s) => `  - ${s.name} (${s.url}) — ${s.focus}`).join("\n")
  ).join("\n");
}

module.exports = { SOURCE_GROUPS, sourcesSummary };
