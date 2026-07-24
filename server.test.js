const test = require("node:test");
const assert = require("node:assert");
const { createServer, sanitizeMessages } = require("./server");

// A stub "brain" so tests never hit the network. It echoes the last
// user message so we can assert the server forwarded it correctly.
function stubChat(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return Promise.resolve(`Ned says: ${lastUser ? lastUser.content : "(nothing)"}`);
}

function startServer(chat = stubChat) {
  const server = createServer({ chat });
  return new Promise((resolve) => {
    server.listen(0, () => {
      const { port } = server.address();
      resolve({ server, base: `http://localhost:${port}` });
    });
  });
}

test("GET / serves the HTML page", async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(base + "/");
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    const body = await res.text();
    assert.match(body, /Ask <span class="jersey">Ned<\/span>/);
  } finally {
    server.close();
  }
});

test("POST /api/chat returns a reply for the last user message", async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "What is the yellow jersey?" }],
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.reply, "Ned says: What is the yellow jersey?");
  } finally {
    server.close();
  }
});

test("POST /api/chat rejects an empty message list", async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    assert.strictEqual(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/chat rejects invalid JSON", async () => {
  const { server, base } = await startServer();
  try {
    const res = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    assert.strictEqual(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /api/chat returns 413 when the body is too large", async () => {
  const { server, base } = await startServer();
  try {
    const huge = "x".repeat(200 * 1024);
    const res = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: huge }] }),
    });
    assert.strictEqual(res.status, 413);
  } finally {
    server.close();
  }
});

test("POST /api/chat surfaces a 502 when the brain throws", async () => {
  const failing = () => Promise.reject(new Error("API down"));
  const { server, base } = await startServer(failing);
  try {
    const res = await fetch(base + "/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    assert.strictEqual(res.status, 502);
    const data = await res.json();
    assert.match(data.detail, /API down/);
  } finally {
    server.close();
  }
});

test("sanitizeMessages drops malformed entries and trims content", () => {
  const cleaned = sanitizeMessages([
    { role: "user", content: "  hello  " },
    { role: "system", content: "ignore me" },
    { role: "assistant", content: "" },
    { role: "assistant", content: "hi there" },
    { role: "user" },
    "nope",
  ]);
  assert.deepStrictEqual(cleaned, [
    { role: "user", content: "hello" },
    { role: "assistant", content: "hi there" },
  ]);
});
