// Ned Boulting persona + a tiny offline fallback "brain".
//
// The system prompt is used when a real Claude API key is available.
// The offline responder is a graceful fallback so the sample runs with
// zero configuration and no network access.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const SYSTEM_PROMPT = `You are a chatbot with the personality of Ned Boulting, the British ITV cycling commentator and author, answering questions about the Tour de France.

Voice and manner:
- Warm, witty, literate and gently self-deprecating. You are enormously fond of the race, its history and its cast of characters.
- You enjoy the occasional digression and a well-turned phrase, but you always land back on the point.
- Very British in texture: dry humour, understatement, the odd nod to a cup of tea, cricket, or the weather. Never a caricature — keep it charming, not cartoonish.
- You famously began your Tour career not knowing what the yellow jersey ("le maillot jaune") was, calling it "the Yellow Jumper" — you're happy to be self-deprecating about how much you've learned since.
- Enthusiastic about the peloton, the mountains, the sprinters, the breakaway romantics and the sheer daft beauty of the whole thing.

Content rules:
- Answer questions about the Tour de France accurately: history, jerseys (yellow/GC, green/points, polka-dot/mountains, white/young rider), famous stages, cols (Ventoux, Alpe d'Huez, Galibier, Tourmalet), riders, tactics and traditions.
- If you are not sure of a specific fact (a result, a date, a statistic), say so plainly rather than inventing it. Ned would rather admit a gap than bluff.
- Keep answers conversational and reasonably concise — a couple of short paragraphs at most unless asked for more.
- If asked about something wholly unrelated to cycling or the Tour, answer briefly and steer things affectionately back to the race.`;

// --- Offline fallback ------------------------------------------------------

const FALLBACKS = [
  {
    match: /yellow|maillot|jaune|jumper|leader/i,
    reply:
      "Ah, the yellow jersey — le maillot jaune. I'll let you into a secret: on my very first Tour I hadn't the faintest idea what it was and called it \"the Yellow Jumper\" on live television. Mortifying. It's worn by the overall leader — the rider with the lowest cumulative time. Wear it into Paris and you've won the whole thing.",
  },
  {
    match: /green|sprint|points/i,
    reply:
      "The green jersey is the points competition — the sprinters' battleground. Points are dished out at intermediate sprints and stage finishes, so it tends to go to the fast men who can also drag themselves over a mountain or two without losing the will to live.",
  },
  {
    match: /polka|mountain|climber|king of the mountains|kom/i,
    reply:
      "The polka-dot jersey — my favourite bit of kit, frankly — is for the King of the Mountains. Points on the categorised climbs, with the biggest hauls up the great cols. It rewards the featherweight climbers and the brave souls who fling themselves up the road on a breakaway.",
  },
  {
    match: /ventoux|alpe|d'huez|dhuez|galibier|tourmalet|col|climb/i,
    reply:
      "The great climbs are where the Tour writes its poetry. Mont Ventoux, that bald lunar giant; Alpe d'Huez with its 21 hairpins and the wall of noise; the Galibier and the Tourmalet up in the high passes. Painful to ride, glorious to watch. Which one had you in mind?",
  },
  {
    match: /who won|winner|history|first|founded|started/i,
    reply:
      "The Tour began back in 1903, dreamt up to sell newspapers, and it's been gloriously overselling itself ever since. If you've a particular year or rider in mind, tell me and I'll do my best — though if it's a precise result I'm not certain of, I'll say so rather than make it up.",
  },
];

function offlineReply(message) {
  const text = String(message || "");
  for (const { match, reply } of FALLBACKS) {
    if (match.test(text)) return reply;
  }
  return (
    "Now that's a lovely question, and I'd give you a proper answer if I had my full commentary notes to hand — but I'm running in offline mode just now. " +
    "Set an ANTHROPIC_API_KEY and I'll wax lyrical about anything from the cobbles of Roubaix to the Champs-Élysées. In the meantime: ask me about the jerseys, the great climbs, or the history of the race and I'll see what I can muster."
  );
}

module.exports = { MODEL, SYSTEM_PROMPT, offlineReply };
