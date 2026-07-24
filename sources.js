// Curated cycling news & data sources.
//
// Single source of truth is cycling_news_sources.yaml, read and parsed here at
// load time. We use a tiny purpose-built parser (the file has a fixed, simple
// shape) so the app stays dependency-free — no YAML library needed. Edit the
// YAML and restart; the UI ("Latest sources" panel) and Ned's context both
// update automatically.

const fs = require("fs");
const path = require("path");

const YAML_PATH = path.join(__dirname, "cycling_news_sources.yaml");

// Prettify a snake_case group key → display label
// (e.g. "results_and_data" → "Results & data").
function prettify(key) {
  const t = key.replace(/_and_/g, " & ").replace(/_/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function stripQuotes(v) {
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

// key: value on a line — split on the FIRST colon (URLs contain colons too).
function addField(item, line) {
  const i = line.indexOf(":");
  if (i === -1) return;
  const key = line.slice(0, i).trim();
  const val = stripQuotes(line.slice(i + 1).trim());
  if (key) item[key] = val;
}

// Parse the fixed 2-space-indented structure:
//   root:
//     <category>:
//       - name: ...
//         url: ...
function parseSourcesYaml(text) {
  const groups = [];
  let group = null;
  let item = null;

  for (const raw of text.split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const indent = raw.length - raw.trimStart().length;
    const line = raw.trim();

    if (indent === 0) continue; // root key (cycling_news_sources:)

    if (indent === 2 && line.endsWith(":")) {
      group = { category: prettify(line.slice(0, -1)), sources: [] };
      groups.push(group);
      item = null;
      continue;
    }

    if (line.startsWith("- ")) {
      if (!group) continue;
      item = {};
      group.sources.push(item);
      addField(item, line.slice(2).trim());
      continue;
    }

    if (item) addField(item, line);
  }

  return groups;
}

function loadSourceGroups() {
  try {
    return parseSourcesYaml(fs.readFileSync(YAML_PATH, "utf8"));
  } catch (err) {
    console.warn(`Could not read ${YAML_PATH}: ${err.message}`);
    return [];
  }
}

const SOURCE_GROUPS = loadSourceGroups();

// Compact, grouped list for the LLM's context.
function sourcesSummary() {
  return SOURCE_GROUPS.map(
    (g) =>
      `${g.category}:\n` +
      g.sources
        .map((s) => `  - ${s.name} (${s.url}) — ${s.focus || ""}`)
        .join("\n")
  ).join("\n");
}

module.exports = { SOURCE_GROUPS, sourcesSummary };
