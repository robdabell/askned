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

function selectProvider() {
  if (process.env.OPENAI_BASE_URL) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "offline";
}

// Human-readable label for the startup log.
function providerLabel() {
  switch (selectProvider()) {
    case "openai":
      return `OpenAI-compatible (${process.env.OPENAI_BASE_URL}, model ${
        process.env.OPENAI_MODEL || "not set"
      })`;
    case "anthropic":
      return `live (Claude API, model ${MODEL})`;
    default:
      return "offline (fallback responder)";
  }
}

// messages: [{ role: "user" | "assistant", content: string }, ...]
async function chat(messages) {
  switch (selectProvider()) {
    case "openai":
      return chatOpenAICompatible(messages);
    case "anthropic":
      return chatAnthropic(messages);
    default: {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      return offlineReply(lastUser && lastUser.content);
    }
  }
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
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
    }),
  });

  if (res.status === 429) return RATE_LIMIT_REPLY;
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Claude API error ${res.status}: ${detail.slice(0, 500)}`);
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
async function chatOpenAICompatible(messages) {
  const baseUrl = process.env.OPENAI_BASE_URL.replace(/\/+$/, "");
  // Ollama ignores the key, but some servers require the header to exist.
  const apiKey = process.env.OPENAI_API_KEY || "not-needed";
  const model = process.env.OPENAI_MODEL || "llama3.2";
  const system = await systemPrompt();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (res.status === 429) return RATE_LIMIT_REPLY;
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM API error ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = (
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content
      ? data.choices[0].message.content
      : ""
  ).trim();

  return text || "…I appear to have lost my thread entirely. Ask me again?";
}

module.exports = { chat, providerLabel };
