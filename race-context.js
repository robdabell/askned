// Live reference data about the current year's Tour de France.
//
// The LLM's training data has a cutoff, so it can't reliably answer questions
// about the race happening right now. To fix that, we fetch the current year's
// Tour de France article from Wikipedia (plain text) and hand it to the model
// as reference context. Free, no API key, and it self-updates as the race runs.
//
// The result is cached in memory so we don't hit Wikipedia on every message.

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const MAX_CONTEXT_CHARS = 12000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

let cache = { year: null, text: "", fetchedAt: 0 };

function currentYear() {
  return new Date().getFullYear();
}

// Returns the plain-text article for `<year> Tour de France`, or "" if there
// is no such page yet (e.g. a future edition) or the fetch fails.
async function fetchRaceArticle(year) {
  const params = new URLSearchParams({
    action: "query",
    prop: "extracts",
    explaintext: "1",
    redirects: "1",
    format: "json",
    titles: `${year} Tour de France`,
  });

  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: { "User-Agent": "tdf-chatbot/1.0 (sample app)" },
  });
  if (!res.ok) throw new Error(`Wikipedia error ${res.status}`);

  const data = await res.json();
  const pages = (data.query && data.query.pages) || {};
  const page = Object.values(pages)[0] || {};
  if (page.missing !== undefined || !page.extract) return "";

  return page.extract.slice(0, MAX_CONTEXT_CHARS);
}

// Cached accessor. Never throws — on failure it returns whatever is cached
// (possibly "") so the chatbot still works, just without live data.
async function getRaceContext() {
  const year = currentYear();
  const fresh =
    cache.year === year && Date.now() - cache.fetchedAt < CACHE_TTL_MS;
  if (fresh) return cache.text;

  try {
    const text = await fetchRaceArticle(year);
    cache = { year, text, fetchedAt: Date.now() };
  } catch (err) {
    console.warn(`Could not refresh race context: ${err.message}`);
    if (cache.year !== year) cache = { year, text: "", fetchedAt: Date.now() };
  }
  return cache.text;
}

// Builds the reference block appended to the system prompt.
async function buildContextBlock() {
  const text = await getRaceContext();
  if (!text) return "";
  return (
    `\n\n--- LIVE REFERENCE: THE ${currentYear()} TOUR DE FRANCE ---\n` +
    `The following is current, factual reference material (from Wikipedia) about this year's race. ` +
    `Use it as the source of truth for any question about the ${currentYear()} Tour — riders, teams, ` +
    `stages, standings and results. If a detail isn't covered here, say so plainly rather than guessing. ` +
    `Weave the facts into your own Ned Boulting voice; don't quote it verbatim.\n\n` +
    text
  );
}

module.exports = { getRaceContext, buildContextBlock, currentYear };
