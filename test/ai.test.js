const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createAiClient } = require("../services/ai");
const { educationalResponse } = require("../services/education");
const base = educationalResponse("Explique a diferença entre PEC e projeto de lei");
const input = { pergunta: "Explique a diferença entre PEC e projeto de lei", intent: base.intent, respostaBase: base.reply, dados: base.dados, fontes: base.sources };
const completed = text => ({ ok: true, json: async () => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] }) });
const setup = (overrides = {}, options = {}) => {
  const events = [], calls = [];
  const client = createAiClient({
    env: { AI_ENABLED: "true", OPENAI_API_KEY: "test-placeholder-not-a-real-key", ...overrides },
    logger: event => events.push(event),
    fetchImpl: async (...args) => { calls.push(args); return completed("Resposta simulada apenas para testes."); },
    ...options,
  });
  return { ...client, events, calls };
};
test("geração simulada usa Responses, contexto confiável e limites sem armazenar resposta", async () => {
  const client = setup();
  assert.equal(await client.generate(input), "Resposta simulada apenas para testes.");
  assert.equal(client.calls.length, 1);
  const [url, request] = client.calls[0], body = JSON.parse(request.body);
  assert.equal(url, "https://api.openai.com/v1/responses");
  assert.equal(request.redirect, "error");
  assert.equal(body.store, false);
  assert.equal(body.max_output_tokens, 800);
  assert.equal(body.reasoning.effort, "minimal");
  assert.equal(body.input[1].content, input.pergunta);
  assert.ok(body.input[0].content.includes(base.sources[0].url));
  assert.deepEqual(client.events, [{ event: "ai_result", reason: "generated" }]);
});
for (const [overrides, reason] of [
  [{ AI_ENABLED: undefined }, "disabled"], [{ AI_ENABLED: "false" }, "disabled"],
  [{ OPENAI_API_KEY: "" }, "missing_key"], [{ AI_TIMEOUT_MS: "0" }, "invalid_configuration"],
  [{ AI_MAX_OUTPUT_TOKENS: "999999" }, "invalid_configuration"], [{ AI_DAILY_REQUEST_LIMIT: "infinito" }, "invalid_configuration"],
]) test(`configuração segura: ${reason} ${JSON.stringify(overrides)}`, async () => {
  const client = setup(overrides);
  assert.equal(await client.generate(input), null);
  assert.equal(client.calls.length, 0);
  assert.equal(client.events.at(-1).reason, reason);
});
for (const url of ["javascript:alert(1)", "https://www12.senado.leg.br.evil.example/", "https://example.com/", "https://user:password@www12.senado.leg.br/", "https://www12.senado.leg.br:8080/"]) {
  test(`não usa fonte não autorizada: ${url}`, async () => {
    const client = setup();
    assert.equal(await client.generate({ ...input, fontes: [{ title: "Fonte", url }] }), null);
    assert.equal(client.calls.length, 0);
  });
}
test("não chama IA sem dados/fontes nem com entrada/contexto excessivos", async () => {
  const client = setup();
  for (const patch of [{ dados: null }, { fontes: [] }, { pergunta: "x".repeat(2001) }, { dados: "x".repeat(16001) }]) assert.equal(await client.generate({ ...input, ...patch }), null);
  assert.equal(client.calls.length, 0);
});
for (const status of [401, 403, 429, 500, 502, 503, 504]) test(`HTTP ${status} usa fallback, sem retry nem corpo privado nos logs`, async () => {
  let requests = 0;
  const client = setup({}, { fetchImpl: async () => { requests++; return { ok: false, status, text: () => { throw new Error("Não ler detalhes privados"); } }; } });
  assert.equal(await client.generate(input), null);
  assert.equal(requests, 1);
  assert.deepEqual(client.events, [{ event: "ai_result", reason: "provider_http_error", status }]);
});
for (const [data, reason] of [
  [{ status: "incomplete", output_text: "Texto parcial" }, "incomplete_output"],
  [{ status: "completed", output: [] }, "empty_or_oversized_output"],
  [{ status: "completed", output_text: "Veja https://example.com/fonte-inventada" }, "untrusted_output_link"],
  [{ status: "completed", output_text: "Veja HTTPS://example.com/fonte-inventada" }, "untrusted_output_link"],
  [{ status: "completed", output_text: "[Link](javascript:alert(1))" }, "untrusted_output_link"],
]) test(`não publica saída inválida: ${reason}`, async () => {
  const client = setup({}, { fetchImpl: async () => ({ ok: true, json: async () => data }) });
  assert.equal(await client.generate(input), null);
  assert.equal(client.events.at(-1).reason, reason);
});
test("falhas de rede e JSON inválido são sanitizadas", async () => {
  for (const fetchImpl of [async () => { throw new Error("PRIVATE_PROVIDER_ERROR"); }, async () => ({ ok: true, json: async () => { throw new Error("PRIVATE_BODY"); } })]) {
    const client = setup({}, { fetchImpl });
    assert.equal(await client.generate(input), null);
    assert.equal(client.events.at(-1).reason, "provider_network_or_parse_error");
    assert.ok(!JSON.stringify(client.events).includes("PRIVATE"));
    assert.ok(!JSON.stringify(client.events).includes(input.pergunta));
  }
});
for (const stage of ["fetch", "body"]) test(`timeout total encerra ${stage} pendente e não repete`, async () => {
  let signal, requests = 0;
  const never = new Promise(() => {});
  const client = setup({ AI_TIMEOUT_MS: "1000" }, { fetchImpl: async (_, options) => { signal = options.signal; requests++; return stage === "fetch" ? never : { ok: true, json: () => never }; } });
  const started = Date.now();
  assert.equal(await client.generate(input), null);
  assert.equal(requests, 1);
  assert.equal(signal.aborted, true);
  assert.ok(Date.now() - started < 4000);
  assert.equal(client.events.at(-1).reason, "timeout");
});
test("limite diário inclui falhas e reinicia no próximo dia UTC", async () => {
  let clock = Date.parse("2026-11-14T12:00:00Z");
  const client = setup({ AI_DAILY_REQUEST_LIMIT: "2" }, { now: () => clock });
  await client.generate(input); await client.generate(input);
  assert.equal(await client.generate(input), null);
  assert.equal(client.calls.length, 2);
  assert.equal(client.events.at(-1).reason, "daily_limit");
  clock += 86400000;
  assert.ok(await client.generate(input));
  assert.equal(client.calls.length, 3);
});
test("limite de cinco chamadas/minuto é global, sem depender de cabeçalho IP", async () => {
  let clock = Date.parse("2026-11-14T12:00:00Z");
  const client = setup({}, { now: () => clock });
  for (let i = 0; i < 5; i++) await client.generate(input);
  assert.equal(await client.generate(input), null);
  assert.equal(client.events.at(-1).reason, "minute_limit");
  clock += 60000;
  assert.ok(await client.generate(input));
  assert.equal(client.calls.length, 6);
});
test("uma única geração por processo e erro do provedor também consome orçamento", async () => {
  let release, requests = 0;
  const pending = new Promise(resolve => { release = resolve; });
  const client = setup({ AI_DAILY_REQUEST_LIMIT: "1" }, { fetchImpl: async () => { requests++; await pending; return { ok: false, status: 503 }; } });
  const first = client.generate(input);
  assert.equal(await client.generate(input), null);
  release(); await first;
  assert.equal(await client.generate(input), null);
  assert.equal(requests, 1);
  assert.equal(client.events.at(-1).reason, "daily_limit");
});
test("requisição concorrente recebe fallback sem duplicar a geração", async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const client = setup({}, { fetchImpl: async () => { await pending; return completed("Texto simulado"); } });
  const first = client.generate(input);
  assert.equal(await client.generate(input), null);
  assert.equal(client.events.at(-1).reason, "busy");
  release(); assert.equal(await first, "Texto simulado");
});
for (const [code, reason] of [["invalid_api_key", "invalid_key"], ["insufficient_quota", "quota_unavailable"], ["model_not_found", "model_unavailable"], ["rate_limit_exceeded", "provider_rate_limit"], ["unsupported_parameter", "invalid_provider_configuration"]]) {
  test(`diagnóstico sanitizado do provedor: ${code}`, async () => {
    const client = setup({}, { fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({ error: { code, message: "PRIVATE_TEXT" } }) }) });
    assert.equal(await client.generate(input), null);
    assert.equal(client.events.at(-1).reason, reason);
    assert.ok(!JSON.stringify(client.events).includes("PRIVATE_TEXT"));
  });
}
