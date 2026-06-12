const express = require("express");
const dotenv = require("dotenv");

const { buscarDeputado, buscarProjetoLei } = require("./services/camara");
const { buscarSenador } = require("./services/senado");

dotenv.config();

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

function getFirst(value) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatarPolitico(politico) {
  return `${politico.nome} e ${politico.tipo}, do partido ${politico.partido}, e representa ${politico.uf}.`;
}

function formatarProjeto(projeto) {
  return `${projeto.tipo} ${projeto.numero}/${projeto.ano}: ${projeto.ementa}`;
}

async function responderPolitico(nome) {
  if (!nome) {
    return "Informe o nome do politico que voce quer consultar.";
  }

  let politico = await buscarDeputado(nome);

  if (!politico) {
    politico = await buscarSenador(nome);
  }

  if (!politico) {
    return "Politico nao encontrado.";
  }

  return formatarPolitico(politico);
}

async function responderProjetoLei({ tipo = "PL", numero, ano }) {
  const numeroProjeto = Number(getFirst(numero));
  const anoProjeto = Number(getFirst(ano));

  if (!numeroProjeto || !anoProjeto) {
    return "Informe o tipo, numero e ano do projeto. Exemplo: PL 2630/2020.";
  }

  const projeto = await buscarProjetoLei(
    String(tipo || "PL").toUpperCase(),
    numeroProjeto,
    anoProjeto
  );

  if (!projeto) {
    return "Projeto de lei nao encontrado.";
  }

  return formatarProjeto(projeto);
}

function extrairProjetoLei(message) {
  const texto = normalizarTexto(message).toUpperCase();
  const matchComTipo = texto.match(/\b(PL|PEC|PLP|MPV|PDL|PDC)\s*(\d+)(?:\s*(?:\/|DE)?\s*(\d{4}))?/);

  if (matchComTipo) {
    return {
      tipo: matchComTipo[1],
      numero: matchComTipo[2],
      ano: matchComTipo[3],
    };
  }

  const matchProjeto = texto.match(/\bPROJETO\s+(\d+)(?:\s*(?:\/|DE)?\s*(\d{4}))?/);

  if (matchProjeto) {
    return {
      tipo: "PL",
      numero: matchProjeto[1],
      ano: matchProjeto[2],
    };
  }

  return null;
}

function extrairNomePolitico(message) {
  const texto = normalizarTexto(message).replace(/[?!.,;:]+$/g, "");
  const patterns = [
    /^quem\s+e\s+(.+)$/,
    /^dados\s+(?:sobre|de)\s+(.+)$/,
    /^informacoes\s+sobre\s+(.+)$/,
    /^me\s+fale\s+sobre\s+(.+)$/,
    /^fale\s+sobre\s+(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = texto.match(pattern);

    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

async function responderMensagem(message) {
  const projeto = extrairProjetoLei(message);

  if (projeto) {
    return {
      intent: "BuscarProjetoLei",
      reply: await responderProjetoLei(projeto),
    };
  }

  const nomePolitico = extrairNomePolitico(message);

  if (nomePolitico) {
    return {
      intent: "BuscarPolitico",
      reply: await responderPolitico(nomePolitico),
    };
  }

  return {
    intent: "Fallback",
    reply:
      "Ainda nao entendi sua pergunta. Tente perguntar por um politico ou por um projeto, como PL 2630/2020.",
  };
}

app.get("/", (req, res) => {
  res.json({ status: "ok", service: "chatbot-politico" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();

  if (!message) {
    return res.status(400).json({
      error: "message is required",
    });
  }

  try {
    const response = await responderMensagem(message);

    return res.json({
      reply: response.reply,
      intent: response.intent,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Erro ao consultar dados politicos.",
    });
  }
});

app.post("/webhook", async (req, res) => {
  const intent = req.body?.queryResult?.intent?.displayName;
  const params = req.body?.queryResult?.parameters || {};

  try {
    if (intent === "BuscarPolitico") {
      return res.json({
        fulfillmentText: await responderPolitico(params.politico),
      });
    }

    if (intent === "BuscarProjetoLei") {
      return res.json({
        fulfillmentText: await responderProjetoLei({
          tipo: params.Tipodeprojeto || "PL",
          numero: params.numero,
          ano: params.ano,
        }),
      });
    }

    return res.json({
      fulfillmentText: "Intent nao reconhecida.",
    });
  } catch (error) {
    console.error(error);

    return res.json({
      fulfillmentText: "Erro ao consultar dados politicos.",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
