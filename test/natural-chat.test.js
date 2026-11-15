process.env.NODE_ENV = "test";
process.env.AI_ENABLED = "true";
process.env.GEMINI_FREE_TIER_CONFIRMED = "true";
process.env.GEMINI_API_KEY = "test-placeholder-not-real";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const originalFetch = globalThis.fetch;
const { app } = require("../server");
let server, base, calls = 0, fail = false;
before(async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    calls++;
    const body = JSON.parse(options.body);
    assert.ok(body.systemInstruction.parts[0].text.includes("base_educativa_revisada"));
    return { ok: !fail, status: fail ? 429 : 200, json: async () => fail
      ? { error: { status: "RESOURCE_EXHAUSTED" } }
      : { candidates: [{ finishReason: "STOP", content: { parts: [{ text: "**Texto Gemini simulado apenas neste teste.**" }] } }] } };
  };
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { globalThis.fetch = originalFetch; server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
const ask = async message => {
  const response = await originalFetch(base + "/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
  assert.equal(response.status, 200);
  return response.json();
};
for (const question of ["Me diz quem é o Lula.", "Quem é Jair Bolsonaro?", "O que é esquerda e direita na política?"]) test(`HTTP com geração Gemini simulada e fonte correspondente: ${question}`, async () => {
  const response = await ask(question);
  assert.equal(response.mode, "ai");
  assert.match(response.reply, /Texto Gemini simulado/);
  assert.match(response.reply, /revisad[ao] em 2026-11-14/);
  assert.ok(response.sources.length);
  assert.deepEqual(Object.keys(response).sort(), ["intent", "mode", "reply", "sources"]);
});
test("HTTP 429 de Gemini preserva biografia histórica e fontes sem retry", async () => {
  fail = true;
  const previous = calls, response = await ask("Quem é Luiz Inácio Lula da Silva?");
  assert.equal(response.mode, "template");
  assert.match(response.reply, /eleito deputado federal constituinte em 1986/);
  assert.equal(calls, previous + 1);
  assert.equal(response.sources.length, 2);
});
test("sem contexto atual e fora do escopo não consomem chamada", async () => {
  const previous = calls;
  for (const question of ["Qual o partido atual de Bolsonaro?", "Como fazer uma receita?", "Qual é o melhor partido?"]) {
    const response = await ask(question);
    assert.equal(response.mode, "template");
    assert.deepEqual(response.sources, []);
  }
  assert.equal(calls, previous);
});
