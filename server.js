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
  chat: "Converse de forma clara, útil e respeitosa. Responda em português do Brasil. Para assuntos que mudam com o tempo — especialmente jogos de futebol, adversários, datas, horários, escalações e placares — não trate informações antigas da sua memória como atuais. Se não tiver uma fonte de consulta em tempo real disponível nesta conversa, diga claramente que não consegue confirmar a informação ao vivo e não invente nem suponha adversários, datas ou resultados. Quando a pergunta estiver ambígua (por exemplo, qual time ou partida), peça um esclarecimento curto.",
  study: "Você é um tutor paciente. Explique em português simples, passo a passo, e ajude o estudante a aprender.",
  organize: "Você é um assistente de organização. Ajude a dividir objetivos em tarefas realistas e etapas práticas.",
  finance: "Você é um educador financeiro. Explique orçamento, economia e planejamento de forma educativa. Nunca peça senhas, dados bancários ou informações confidenciais."
};

app.get("/health", (req, res) => {
  const geminiKeyPresent = typeof process.env.GEMINI_API_KEY === "string"
    && process.env.GEMINI_API_KEY.trim().length > 0;
  res.json({
    status: "ok",
    geminiConfigured: geminiKeyPresent,
    geminiKeyPresent
  });
});

function demoAnswer(message, mode) {
  const question = message.trim();
  if (/\b(oi|olá|ola|bom dia|boa tarde|boa noite)\b/i.test(question)) {
    return "Olá! Sou o assistente do Veletti. Estou no modo demonstração gratuito, então minhas respostas são simples e pré-programadas. Como posso ajudar?";
  }
  if (/nome|quem é você|quem e voce|veletti/i.test(question)) {
    return "Eu sou o assistente do Veletti, uma plataforma para conversar, estudar, organizar tarefas e aprender sobre finanças. Esta é uma demonstração gratuita, não uma resposta gerada por uma IA online.";
  }
  if (mode === "study") {
    return "Vamos estudar por etapas! Primeiro, identifique a ideia principal do assunto. Depois, veja um exemplo e tente explicar com suas próprias palavras. Esta resposta é de demonstração; a IA completa estará disponível quando a chave da API estiver configurada e houver cota disponível.";
  }
  if (mode === "organize") {
    return "Uma boa forma de começar é anotar tudo, escolher até três prioridades e dividir cada tarefa em passos pequenos. Esta é uma resposta pré-programada do modo demonstração.";
  }
  if (mode === "finance") {
    return "Para organizar seu dinheiro, registre entradas e gastos, separe uma meta de economia e confira os valores com frequência. Não compartilhe senhas ou dados bancários. Esta é uma resposta pré-programada do modo demonstração.";
  }
  return "Recebi sua mensagem: \"" + question.slice(0, 300) + "\". O chat está funcionando no modo demonstração gratuito, com respostas pré-programadas. Para responder perguntas variadas com inteligência artificial, será necessário ter créditos disponíveis na API.";
}

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
  if (!process.env.GEMINI_API_KEY) {
    return res.json({ answer: demoAnswer(message, mode), demo: true });
  }

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify({
        model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
        input: message.trim(),
        system_instruction: modes[mode],
        store: false
      }),
      signal: AbortSignal.timeout(60000)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini API error:", data.error?.message || response.status);
      return res.status(response.status === 429 ? 429 : 502).json({
        error: response.status === 429
          ? "A IA atingiu o limite gratuito por enquanto. Tente novamente mais tarde."
          : "A IA não conseguiu responder. Confira a chave e a configuração do Gemini."
      });
    }

    const answer = (data.steps || [])
      .filter((step) => step.type === "model_output")
      .flatMap((step) => step.content || [])
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text)
      .join("\n")
      .trim();

    if (!answer) {
      return res.status(502).json({ error: "A IA não retornou uma resposta válida." });
    }

    return res.json({ answer, provider: "gemini" });
  } catch (error) {
    console.error("Gemini assistant error:", error.message);
    return res.status(500).json({ error: "Ocorreu um erro ao conversar com o Veletti." });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Servidor Veletti rodando na porta " + PORT);
});
