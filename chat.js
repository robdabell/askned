// The chat "brain". Supports three providers, chosen automatically:
//
//   1. Anthropic (Claude)      — if ANTHROPIC_API_KEY is set.
//   2. OpenAI-compatible API   — if OPENAI_BASE_URL is set. This covers many
//                                free options (Ollama locally, Groq, Gemini's
//                                OpenAI-compatible endpoint, OpenRouter, etc.).
//   3. Offline fallback        — if nothing is configured.
//
// No SDK dependency: we call each HTTP API with the global fetch built into
// Node 18+, keeping this app dependency-free.

const { spawn, execFile, execFileSync } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { MODEL, SYSTEM_PROMPT, offlineReply } = require("./persona");
const { buildContextBlock } = require("./race-context");
const { stagesSummary } = require("./stages-2026");
const { sourcesSummary } = require("./sources");

const STAGE_BLOCK =
  `\n\n--- 2026 TOUR DE FRANCE STAGE LIST ---\n` +
  `The route the user can view (each stage's official map & profile is in the ` +
  `app's "Route visuals" panel, embedded from letour.fr):\n\n` +
  stagesSummary();

const SOURCES_BLOCK =
  `\n\n--- TRUSTED SOURCES FOR THE LATEST INFO ---\n` +
  `These are listed in the app's "Latest sources" panel. When you don't hold a ` +
  `fact (live standings, today's result, breaking news), point the user to the ` +
  `most relevant one rather than guessing — official/results sources for facts, ` +
  `media for reports and analysis:\n\n` +
  sourcesSummary();

async function systemPrompt() {
  return (
    SYSTEM_PROMPT + STAGE_BLOCK + SOURCES_BLOCK + (await buildContextBlock())
  );
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 2048;

// Shown (in Ned's voice) when the provider rate-limits us — common on free
// tiers. Returned as a normal reply so the conversation degrades gracefully.
const RATE_LIMIT_REPLY =
  "Woah, steady on! You've got me talking faster than a sprinter on the " +
  "Champs-Élysées and I've quite run out of puff — the free API quota is maxed " +
  "out for the moment. It seems ITV haven't paid for enough AI tokens; fingers " +
  "crossed Channel 5 start stumping up for a few more in a minute or so. Give me " +
  "a moment to get my breath back, then ask again.";

// --- Local LLM fallback config ----------------------------------------------
// When the primary provider is rate-limited or errors, we retry a free local
// model over a local OpenAI-compatible server before giving up. Works with
// LM Studio (default, :1234) or Ollama (:11434) — both speak the same API.
// Enabled by default; set LOCAL_LLM_FALLBACK=0 to disable. If LOCAL_LLM_MODEL
// is unset we auto-detect whichever model the local server currently has loaded.
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || "http://localhost:1234/v1";
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || ""; // "" = auto-detect
const LOCAL_LLM_FALLBACK_ENABLED = process.env.LOCAL_LLM_FALLBACK !== "0";
const FALLBACK_TIMEOUT_MS = 60000;
const FALLBACK_NOTE =
  "\n\n(Ned here, piping up from a local back-up model while the main service " +
  "catches its breath.)";

// Auto-start: if the local server/model isn't up when we need it, kick off
// LM Studio via its `lms` CLI and cover the gap with an advert-break message.
const LOCAL_LLM_AUTOSTART = process.env.LOCAL_LLM_AUTOSTART !== "0";
const ADVERT_BREAK_REPLY =
  "Advert break! A chance for David and I to get some nibbles while the local " +
  "model warms up in the background. Give it a few seconds and ask me again — " +
  "we'll be right back after these messages.";

// Typed error so chat() can tell a rate-limit from a hard failure.
class ProviderError extends Error {
  constructor(message, { rateLimit = false } = {}) {
    super(message);
    this.name = "ProviderError";
    this.rateLimit = rateLimit;
  }
}

function selectProvider() {
  if (process.env.OPENAI_BASE_URL) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "offline";
}

// Human-readable label for the startup log.
function providerLabel() {
  const fb =
    LOCAL_LLM_FALLBACK_ENABLED && selectProvider() !== "offline"
      ? ` [local fallback: ${LOCAL_LLM_MODEL || "auto"} @ ${LOCAL_LLM_URL}]`
      : "";
  switch (selectProvider()) {
    case "openai":
      return `OpenAI-compatible (${process.env.OPENAI_BASE_URL}, model ${
        process.env.OPENAI_MODEL || "not set"
      })${fb}`;
    case "anthropic":
      return `live (Claude API, model ${MODEL})${fb}`;
    default:
      return "offline (fallback responder)";
  }
}

// messages: [{ role: "user" | "assistant", content: string }, ...]
async function chat(messages) {
  const provider = selectProvider();

  if (provider === "offline") {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    return offlineReply(lastUser && lastUser.content);
  }

  try {
    if (provider === "anthropic") return await chatAnthropic(messages);
    return await callOpenAICompatible(messages, {
      baseUrl: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "llama3.2",
    });
  } catch (err) {
    // Primary failed (rate limit or error). Try a local model — unless the
    // primary already IS a local endpoint (don't fall back onto ourselves).
    const primaryIsLocal =
      provider === "openai" &&
      /\/\/(localhost|127\.0\.0\.1)/.test(process.env.OPENAI_BASE_URL || "");

    if (LOCAL_LLM_FALLBACK_ENABLED && !primaryIsLocal) {
      const model = await localModelReady();
      if (model) {
        // Local server is up with a model — let it answer.
        try {
          const reply = await callOpenAICompatible(messages, {
            baseUrl: LOCAL_LLM_URL,
            apiKey: "local",
            model,
            timeoutMs: FALLBACK_TIMEOUT_MS,
          });
          return reply + FALLBACK_NOTE;
        } catch {
          /* local errored — fall through */
        }
      } else if (startLocalLLM()) {
        // Local server/model isn't up yet; we've kicked it off. Cover the gap.
        return ADVERT_BREAK_REPLY;
      }
    }

    if (err && err.rateLimit) return RATE_LIMIT_REPLY;
    throw err;
  }
}

// Is the local server up with a usable (non-embedding) chat model? Returns the
// model id to use, or null if the server is down / still loading.
async function localModelReady() {
  try {
    const res = await fetch(`${LOCAL_LLM_URL.replace(/\/+$/, "")}/models`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const ids = (data.data || []).map((m) => m.id).filter(Boolean);
    if (LOCAL_LLM_MODEL) return ids.includes(LOCAL_LLM_MODEL) ? LOCAL_LLM_MODEL : null;
    return ids.find((id) => !/embed/i.test(id)) || null;
  } catch {
    return null;
  }
}

// Fire-and-forget: start the LM Studio server (idempotent) and load a model via
// its `lms` CLI. Debounced so we don't spawn repeatedly. Returns true if an
// attempt was made (or is in flight), false if auto-start is off/unavailable.
let lastStartAttempt = 0;
let weStartedLocal = false; // true only if this process started LM Studio
function startLocalLLM() {
  if (!LOCAL_LLM_AUTOSTART) return false;
  const now = Date.now();
  if (now - lastStartAttempt < 120000) return true; // recently attempted
  const lms = lmsBinary();
  if (!lms) return false;
  lastStartAttempt = now;
  weStartedLocal = true;

  detachedSpawn(lms, ["server", "start"]);
  if (LOCAL_LLM_MODEL) {
    detachedSpawn(lms, ["load", LOCAL_LLM_MODEL, "-y", "--ttl", "3600"]);
  } else {
    // Discover the first downloaded LLM, then load it.
    execFile(lms, ["ls"], { timeout: 10000 }, (e, stdout) => {
      const key = !e && stdout ? firstDownloadedModel(stdout) : null;
      if (key) detachedSpawn(lms, ["load", key, "-y", "--ttl", "3600"]);
    });
  }
  return true;
}

function detachedSpawn(cmd, args) {
  try {
    const p = spawn(cmd, args, { detached: true, stdio: "ignore" });
    p.on("error", () => {}); // ignore (e.g. binary missing)
    p.unref();
  } catch {
    /* ignore */
  }
}

// Stop LM Studio — but ONLY if this process started it (don't kill a server
// the user was already running). Called on graceful shutdown. Synchronous so
// it completes before the process exits.
function stopLocalLLM() {
  if (!weStartedLocal) return false;
  const lms = lmsBinary();
  if (!lms) return false;
  try {
    execFileSync(lms, ["unload", "--all"], { timeout: 8000, stdio: "ignore" });
  } catch {
    /* ignore */
  }
  try {
    execFileSync(lms, ["server", "stop"], { timeout: 8000, stdio: "ignore" });
  } catch {
    /* ignore */
  }
  weStartedLocal = false;
  return true;
}

// Locate the LM Studio CLI (`lms`), or null if not found.
function lmsBinary() {
  if (process.env.LMS_PATH) return process.env.LMS_PATH;
  const guess = path.join(os.homedir(), ".lmstudio", "bin", "lms");
  return fs.existsSync(guess) ? guess : null;
}

// Parse `lms ls` output for the first downloaded LLM key (e.g. "google/gemma-4-e4b").
function firstDownloadedModel(lsOutput) {
  for (const line of lsOutput.split("\n")) {
    const t = line.trim();
    if (!t || /^(LLM|EMBEDDING|PARAMS|You have)/i.test(t)) continue;
    const key = t.split(" (")[0].split(/\s{2,}/)[0].trim();
    if (key && key.includes("/") && !/embed/i.test(key)) return key;
  }
  return null;
}

async function chatAnthropic(messages) {
  const system = await systemPrompt();
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages }),
  });

  if (res.status === 429) throw new ProviderError("Claude rate limited", { rateLimit: true });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ProviderError(`Claude API error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return text || "…I appear to have lost my thread entirely. Ask me again?";
}

// Works with any endpoint that speaks the OpenAI /chat/completions shape:
// Ollama (http://localhost:11434/v1), Groq, Gemini's OpenAI endpoint, etc.
async function callOpenAICompatible(messages, { baseUrl, apiKey, model, timeoutMs }) {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const system = await systemPrompt();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey || "not-needed"}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: system }, ...messages],
    }),
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  });

  if (res.status === 429) throw new ProviderError("LLM rate limited", { rateLimit: true });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ProviderError(`LLM API error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = sanitizeReply(
    (data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
      ? data.choices[0].message.content
      : "")
  );

  return text || "…I appear to have lost my thread entirely. Ask me again?";
}

// Strip stray chat-template control tokens (e.g. "<|channel>", "<|im_start|>")
// that small local models sometimes leak into their output.
function sanitizeReply(text) {
  return text.replace(/<\|[^|>]*\|?>/g, "").trim();
}

module.exports = { chat, providerLabel, stopLocalLLM };
