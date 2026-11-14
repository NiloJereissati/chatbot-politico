const { test } = require("node:test");
const assert = require("node:assert/strict");
const dotenv = require("dotenv");
const original = dotenv.config;
test("produção e ambiente vazio não leem .env; desenvolvimento só solicita .env.local", () => {
  const calls = [];
  dotenv.config = options => { calls.push(options.path); return {}; };
  process.env.AI_ENABLED = "false";
  try {
    for (const env of ["production", "test", "", "development"]) {
      process.env.NODE_ENV = env;
      delete require.cache[require.resolve("../server")];
      require("../server");
    }
    assert.equal(calls.length, 1);
    assert.ok(calls[0].endsWith(".env.local"));
    assert.ok(!calls.some(path => path.endsWith("/.env") || path.endsWith("\\.env")));
  } finally { dotenv.config = original; }
});
