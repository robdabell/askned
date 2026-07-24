const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  STAGES,
  SAMPLE_ROUTE_ID,
  OFFICIAL_ROUTE_MAP,
  OFFICIAL_ROUTE_PDF,
} = require("./stages-2026");
const { SOURCE_GROUPS } = require("./sources");

const MAX_BODY_BYTES = 100 * 1024; // chat history can be chunky
const MAX_MESSAGES = 40;
const MAX_CONTENT_LENGTH = 4000;

// deps: { chat }  — chat(messages) => Promise<string reply>
function createServer(deps) {
  const { chat } = deps;

  return http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") {
      fs.readFile(path.join(__dirname, "index.html"), (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end("Error loading index.html");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(data);
      });
      return;
    }

    if (req.method === "GET" && req.url === "/api/stages") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          stages: STAGES,
          sampleRouteId: SAMPLE_ROUTE_ID,
          officialRouteMap: OFFICIAL_ROUTE_MAP,
          officialRoutePdf: OFFICIAL_ROUTE_PDF,
        })
      );
      return;
    }

    if (req.method === "GET" && req.url === "/api/sources") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ groups: SOURCE_GROUPS }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/chat") {
      let body = "";
      let size = 0;
      let tooLarge = false;

      req.on("data", (chunk) => {
        if (tooLarge) return;
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Request too large" }));
          return;
        }
        body += chunk;
      });

      req.on("end", async () => {
        if (tooLarge) return;

        let messages;
        try {
          const parsed = JSON.parse(body || "{}");
          messages = sanitizeMessages(parsed.messages);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
          return;
        }

        if (!messages.length) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "No messages provided" }));
          return;
        }

        try {
          const reply = await chat(messages);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ reply }));
        } catch (err) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "The commentary box has gone quiet — something went wrong.",
              detail: String(err && err.message ? err.message : err),
            })
          );
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });
}

// Keep only well-formed { role, content } pairs, trim to sane limits.
function sanitizeMessages(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, MAX_CONTENT_LENGTH),
    }));
}

module.exports = { createServer, sanitizeMessages };

if (require.main === module) {
  const os = require("os");
  const { chat, providerLabel, stopLocalLLM } = require("./chat");
  const PORT = process.env.PORT || 3001;
  // Bind to all interfaces by default (shareable on your LAN). Set HOST to
  // 127.0.0.1 to restrict access to this machine only.
  const HOST = process.env.HOST || "0.0.0.0";
  const server = createServer({ chat });

  server.listen(PORT, HOST, () => {
    console.log(`Tour de France chatbot running at http://localhost:${PORT}`);
    if (HOST === "0.0.0.0" || HOST === "::") {
      const lan = lanAddress(os);
      if (lan) console.log(`On your network:  http://${lan}:${PORT}`);
      console.log("(Open to your LAN — set HOST=127.0.0.1 to restrict to this machine.)");
    }
    console.log(`Mode: ${providerLabel()}`);
  });

  function shutdown() {
    console.log("Shutting down...");
    // Stop LM Studio if (and only if) we auto-started it.
    try {
      if (stopLocalLLM()) console.log("Stopped auto-started LM Studio.");
    } catch {
      /* ignore */
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// First non-internal IPv4 address, for the "share on your network" hint.
function lanAddress(os) {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return null;
}
