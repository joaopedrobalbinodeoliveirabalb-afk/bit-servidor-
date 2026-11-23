const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function startApi(scenario) {
  const port = await freePort();
  const root = path.resolve(__dirname, "..");
  const preload = path.join(__dirname, "mock-providers.cjs");
  const child = spawn(process.execPath, ["--require", preload, "server.js"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      VELETTI_TEST_SCENARIO: scenario,
      GEMINI_API_KEY: "test-gemini-key",
      OPENAI_API_KEY: "test-openai-key",
      CLOUDFLARE_ACCOUNT_ID: "test-account",
      CLOUDFLARE_API_TOKEN: "test-cloudflare-token",
      VELETTI_SESSION_SECRET: "test-session-secret",
      VELETTI_OWNER_PASSWORD: "test-owner-password"
    },
    stdio: ["ignore", "ignore", "pipe"]
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });

  const baseUrl = "http://127.0.0.1:" + port;
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("A API encerrou antes de iniciar: " + stderr);
    }
    try {
      const response = await fetch(baseUrl + "/health");
      if (response.ok) {
        return {
          baseUrl,
          stop: () => new Promise((resolve) => {
            child.once("exit", resolve);
            child.kill("SIGTERM");
            setTimeout(resolve, 1500);
          })
        };
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  child.kill("SIGTERM");
  throw new Error("A API não iniciou a tempo. " + stderr);
}

async function ask(scenario) {
  const api = await startApi(scenario);
  try {
    const response = await fetch(api.baseUrl + "/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Explique o que é uma API.", mode: "chat" })
    });
    const data = await response.json();
    return { status: response.status, data };
  } finally {
    await api.stop();
  }
}

test("usa OpenAI quando Gemini retorna erro HTTP", async () => {
  const result = await ask("gemini-error-openai-ok");
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "openai");
  assert.match(result.data.answer, /OpenAI/);
});

test("usa OpenAI quando Gemini retorna resposta vazia", async () => {
  const result = await ask("gemini-empty-openai-ok");
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "openai");
  assert.match(result.data.answer, /OpenAI/);
});

test("usa OpenAI quando ocorre falha de rede no Gemini", async () => {
  const result = await ask("gemini-network-error");
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "openai");
  assert.match(result.data.answer, /OpenAI/);
});

test("usa Cloudflare quando Gemini e OpenAI falham", async () => {
  const result = await ask("openai-fails-cloudflare-ok");
  assert.equal(result.status, 200);
  assert.equal(result.data.provider, "cloudflare");
  assert.match(result.data.answer, /Cloudflare/);
});

test("health informa somente a presença de configuração dos provedores", async () => {
  const api = await startApi("gemini-error-openai-ok");
  try {
    const response = await fetch(api.baseUrl + "/health");
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(data.providers, {
      gemini: true,
      openai: true,
      cloudflare: true
    });
    assert.equal(JSON.stringify(data).includes("test-openai-key"), false);
    assert.equal(JSON.stringify(data).includes("test-cloudflare-token"), false);
  } finally {
    await api.stop();
  }
});
