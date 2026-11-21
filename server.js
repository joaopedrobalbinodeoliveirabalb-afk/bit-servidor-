require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
// O Render fica atrás de um proxy; isso permite ao rate-limit identificar o IP do cliente.
app.set("trust proxy", 1);
const PORT = process.env.PORT || 3000;

// A interface inicial usa CSS/JavaScript no próprio HTML; CSP será configurada ao separar os assets.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
    : true
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const assistantLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas mensagens em pouco tempo. Tente novamente mais tarde." }
});

const modes = {
  chat: "Converse de forma clara, útil e respeitosa. Responda em português do Brasil.",
  study: "Você é um tutor paciente. Explique em português simples, passo a passo, e ajude o estudante a aprender.",
  organize: "Você é um assistente de organização. Ajude a dividir objetivos em tarefas realistas e etapas práticas.",
  finance: "Você é um educador financeiro. Explique orçamento, economia e planejamento de forma educativa. Nunca peça senhas, dados bancários ou informações confidenciais."
};

app.get("/health", (req, res) => {
  const openaiKeyPresent = typeof process.env.OPENAI_API_KEY === "string"
    && process.env.OPENAI_API_KEY.trim().length > 0;
  const openaiRelatedVariableNames = Object.keys(process.env)
    .filter((name) => name.toUpperCase().includes("OPENAI"));

  res.json({
    status: "ok",
    openaiConfigured: openaiKeyPresent,
    openaiKeyPresent,
    openaiRelatedVariableNames,
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY)
  });
});

app.post("/api/assistant", assistantLimit, async (req, res) => {
  const { message, mode = "chat" } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Escreva uma mensagem para o Veletti." });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: "A mensagem deve ter no máximo 4.000 caracteres." });
  }
  if (!Object.prototype.hasOwnProperty.call(modes, mode)) {
    return res.status(400).json({ error: "Modo inválido." });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: "O chat ainda precisa ser conectado à API de inteligência artificial. Configure OPENAI_API_KEY nas variáveis privadas do servidor."
    });
  }

  try {
    const firstResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: modes[mode],
        input: message.trim()
      }),
      signal: AbortSignal.timeout(60000)
    });

    const firstData = await firstResponse.json();
    if (!firstResponse.ok) {
      console.error("OpenAI API error:", firstData.error?.message || firstResponse.status);
      return res.status(502).json({ error: "A IA não conseguiu responder. Confira a configuração da API." });
    }

    const draft = firstData.output_text;
    if (!draft) {
      return res.status(502).json({ error: "A IA não retornou uma resposta válida." });
    }

    // Claude é uma revisão opcional: o Veletti continua funcionando sem essa chave.
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const reviewResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
            max_tokens: 1200,
            system: "Revise a resposta abaixo em português do Brasil. Corrija erros e deixe-a clara e útil. Não invente fatos. Retorne apenas a resposta revisada.",
            messages: [{
              role: "user",
              content: "Pergunta: " + message.trim() + "\n\nResposta para revisar:\n" + draft
            }]
          }),
          signal: AbortSignal.timeout(60000)
        });
        const reviewData = await reviewResponse.json();
        const revised = reviewData.content?.find((item) => item.type === "text")?.text;
        if (reviewResponse.ok && revised) {
          return res.json({ answer: revised, reviewedByClaude: true });
        }
        console.error("Claude review unavailable:", reviewData.error?.message || reviewResponse.status);
      } catch (reviewError) {
        console.error("Claude review error:", reviewError.message);
      }
    }

    return res.json({ answer: draft, reviewedByClaude: false });
  } catch (error) {
    console.error("Assistant error:", error.message);
    return res.status(500).json({ error: "Ocorreu um erro ao conversar com o Veletti." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Servidor Veletti rodando na porta " + PORT);
});
