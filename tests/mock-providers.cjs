// Mock isolado de provedores externos para os testes automatizados.
const scenario = process.env.VELETTI_TEST_SCENARIO || "gemini-error-openai-ok";

global.fetch = async (input) => {
  const url = typeof input === "string" ? input : input.url;

  if (url.includes("generativelanguage.googleapis.com")) {
    if (scenario === "gemini-network-error") {
      throw new Error("Falha de rede simulada do Gemini");
    }
    if (scenario === "gemini-empty-openai-ok") {
      return new Response(JSON.stringify({ steps: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: { message: "Erro Gemini simulado" } }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (url.includes("api.openai.com")) {
    if (scenario === "openai-fails-cloudflare-ok") {
      return new Response(JSON.stringify({ error: { message: "Erro OpenAI simulado" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { content: "Resposta simulada da OpenAI." } }]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (url.includes("api.cloudflare.com")) {
    return new Response(JSON.stringify({
      success: true,
      result: { response: "Resposta simulada da Cloudflare." }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  throw new Error("URL externa inesperada nos testes: " + url);
};
