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
  chat: "Converse de forma clara, útil e respeitosa. Responda em português do Brasil e seja direto: comece pela resposta principal, sem introduções ou rodeios. REGRA DE CLAREZA SOBRE GALO: sempre que o usuário disser \\"Galo\\" e ainda não estiver claro pelo contexto que fala do time de futebol, pergunte exatamente: \\"Você está falando do Atlético Mineiro?\\". Não presuma que é o Atlético Mineiro antes da confirmação. Depois que o usuário confirmar, use Atlético Mineiro como significado de Galo no restante da conversa. Para assuntos que mudam com o tempo — especialmente jogos, adversários, datas, horários, escalações e placares — não trate informações antigas como atuais. Só informe dados atuais se tiver uma fonte atualizada; se não tiver, diga diretamente que não conseguiu confirmar. Nunca invente adversários, datas ou resultados.",
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

function normalizeTeamName(value) {
  return String(value || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim();
}

function isAffirmative(value) {
  return /^(sim|isso|exatamente|sou|e esse|esse mesmo|correto)[.!\\s]*$/i.test(String(value || "").trim());
}

function extractTeamFromText(value) {
  const text = String(value || "").replace(/\\s+/g, " ").trim();
  const patterns = [
    /(?:pr[oó]xim[oa]s?\\s+)?jogos?\\s+(?:do|da|de)\\s+(.+?)(?:[?.!,]|$)/i,
    /partidas?\\s+(?:do|da|de)\\s+(.+?)(?:[?.!,]|$)/i,
    /(?:resultado|placar)\\s+(?:do|da|de)\\s+(.+?)(?:[?.!,]|$)/i,
    /quando\\s+(?:o|a)?\\s*([a-zÀ-ÿ][a-zÀ-ÿ .'-]{1,45}?)\\s+(?:joga|vai jogar|jogou)/i,
    /quando\\s+joga\\s+(?:o|a)?\\s*(.+?)(?:[?.!,]|$)/i,
    /contra\\s+quem\\s+joga\\s+(?:o|a)?\\s*(.+?)(?:[?.!,]|$)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].replace(/\\b(hoje|amanh[aã]|agora|na pr[oó]xima rodada|na pr[oó]xima partida)\\b/ig, "").trim();
    }
  }
  return null;
}

async function getFootballContext(message, history) {
  const key = process.env.FOOTBALL_API_KEY;
  const conversation = Array.isArray(history) ? history.slice(-12) : [];
  const previousText = conversation.map((item) => String(item.content || "")).join(" ");
  const galoMentioned = /\\bgalo\\b/i.test(message) || /\\bgalo\\b/i.test(previousText);
  const confirmedGalo = galoMentioned &&
    /Você está falando do Atlético Mineiro\\?/i.test(previousText) &&
    isAffirmative(message);
  if (/\\bgalo\\b/i.test(message) && !confirmedGalo &&
      !/Você está falando do Atlético Mineiro\\?/i.test(previousText)) {
    return { directAnswer: "Você está falando do Atlético Mineiro?" };
  }

  if (!key) {
    return { directAnswer: "Para consultar jogos de todos os times, falta configurar a chave FOOTBALL_API_KEY no Render." };
  }

  const combined = confirmedGalo
    ? "jogo do Atlético Mineiro"
    : [message, ...conversation.filter((item) => item.role === "user").map((item) => item.content)].join(" ");
  const teamQuery = confirmedGalo ? "Atlético Mineiro" : extractTeamFromText(combined);
  if (!teamQuery) return null;

  try {
    const teamUrl = new URL("https://v3.football.api-sports.io/teams");
    teamUrl.searchParams.set("search", teamQuery);
    const teamResponse = await fetch(teamUrl, {
      headers: { "x-apisports-key": key },
      signal: AbortSignal.timeout(12000)
    });
    if (!teamResponse.ok) throw new Error("Falha ao consultar times");
    const teamData = await teamResponse.json();
    const teams = Array.isArray(teamData.response) ? teamData.response : [];
    if (!teams.length) return { directAnswer: "Não encontrei esse time na base de dados. Confira o nome do clube e tente novamente." };

    const wanted = normalizeTeamName(teamQuery);
    const exact = teams.find((item) => normalizeTeamName(item.team?.name) === wanted);
    const selected = exact || (teams.length === 1 ? teams[0] : null);
    if (!selected) {
      const names = teams.slice(0, 5).map((item) => item.team?.name).filter(Boolean);
      return { directAnswer: "Encontrei mais de um time com esse nome: " + names.join(", ") + ". Qual deles você quer consultar?" };
    }

    const fixturesUrl = new URL("https://v3.football.api-sports.io/fixtures");
    fixturesUrl.searchParams.set("team", selected.team.id);
    fixturesUrl.searchParams.set("next", "5");
    fixturesUrl.searchParams.set("timezone", "America/Sao_Paulo");
    const fixturesResponse = await fetch(fixturesUrl, {
      headers: { "x-apisports-key": key },
      signal: AbortSignal.timeout(12000)
    });
    if (!fixturesResponse.ok) throw new Error("Falha ao consultar partidas");
    const fixturesData = await fixturesResponse.json();
    const fixtures = Array.isArray(fixturesData.response) ? fixturesData.response : [];
    if (!fixtures.length) return { directAnswer: "Não encontrei próximos jogos cadastrados para " + selected.team.name + " neste momento." };

    const lines = fixtures.map((item) => {
      const date = item.fixture?.date ? new Date(item.fixture.date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "data a confirmar";
      return "- " + item.teams?.home?.name + " x " + item.teams?.away?.name +
        " | " + date + " | " + (item.league?.name || "competição não informada") +
        " | status: " + (item.fixture?.status?.long || "não informado");
    });
    return {
      context: "DADOS ATUALIZADOS CONSULTADOS NA API-FOOTBALL. Use somente estes dados para responder sobre jogos; não invente nem altere datas, horários ou adversários. Time identificado: " +
        selected.team.name + ". Próximos jogos:\\n" + lines.join("\\n")
    };
  } catch (error) {
    console.error("Football API error:", error.message);
    return { directAnswer: "Não consegui consultar os jogos agora. Tente novamente daqui a pouco." };
  }
}

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
  const { message, mode = "chat", history = [] } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Escreva uma mensagem para o Veletti." });
  }
  if (message.length > 4000) {
    return res.status(400).json({ error: "A mensagem deve ter no máximo 4.000 caracteres." });
  }
  if (!Object.prototype.hasOwnProperty.call(modes, mode)) {
    return res.status(400).json({ error: "Modo inválido." });
  }
  const hasFootballFollowUp = Array.isArray(history) && history.some((item) => item && item.role === "user" && /jogos?|partidas?|placar|resultado|quando joga|contra quem/i.test(String(item.content || ""))) && String(message).trim().length < 45;\n  if (mode === "chat" && (/jogos?|partidas?|placar|resultado|quando joga|contra quem/i.test(message) || hasFootballFollowUp)) {\n    const football = await getFootballContext(message, history);\n    if (football?.directAnswer) return res.json({ answer: football.directAnswer, provider: "football" });\n    if (football?.context) req.footballContext = football.context;\n  }\n  if (!process.env.GEMINI_API_KEY) {
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
        input: req.footballContext ? message.trim() + "\\n\\n" + req.footballContext : message.trim(),
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
