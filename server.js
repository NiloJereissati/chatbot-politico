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
  return `${politico.nome} é ${politico.tipo}, do partido ${politico.partido}, e representa ${politico.uf}.`;
}

function formatarProjeto(projeto) {
  return `${projeto.tipo} ${projeto.numero}/${projeto.ano}: ${projeto.ementa}`;
}

async function responderPolitico(nome) {
  if (!nome) {
    return "Informe o nome do político que você quer consultar.";
  }

  let politico = await buscarDeputado(nome);

  if (!politico) {
    politico = await buscarSenador(nome);
  }

  if (!politico) {
    return "Político não encontrado.";
  }

  return formatarPolitico(politico);
}

async function responderProjetoLei({ tipo = "PL", numero, ano }) {
  const numeroProjeto = Number(getFirst(numero));
  const anoProjeto = Number(getFirst(ano));

  if (!numeroProjeto || !anoProjeto) {
    return "Informe o tipo, número e ano do projeto. Exemplo: PL 2630/2020.";
  }

  const projeto = await buscarProjetoLei(
    String(tipo || "PL").toUpperCase(),
    numeroProjeto,
    anoProjeto
  );

  if (!projeto) {
    return "Projeto de lei não encontrado.";
  }

  return formatarProjeto(projeto);
}

const respostasProntas = [
  {
    intent: "ExplicarPEC",
    termos: ["o que e uma pec", "o que e pec", "oque e pec", "pec significa"],
    reply:
      "PEC é uma Proposta de Emenda à Constituição. Ela serve para mudar algum ponto da Constituição Federal e precisa passar por um processo mais rígido que um projeto de lei comum.",
  },
  {
    intent: "ExplicarProjetoLei",
    termos: ["o que e projeto de lei", "o que e um projeto de lei", "projeto de lei"],
    reply:
      "Um projeto de lei é uma proposta para criar, alterar ou revogar uma lei. Ele precisa ser discutido, votado e aprovado pelo Legislativo antes de virar lei.",
  },
  {
    intent: "ExplicarDeputado",
    termos: ["o que um deputado faz", "o que faz um deputado", "funcao de um deputado", "para que serve um deputado"],
    reply:
      "Um deputado representa a população no Poder Legislativo. Ele propõe leis, vota projetos, fiscaliza o governo e participa de debates e comissões sobre temas públicos.",
  },
  {
    intent: "ExplicarSenador",
    termos: ["o que um senador faz", "o que faz um senador", "funcao de um senador", "para que serve um senador"],
    reply:
      "Um senador representa o estado no Senado Federal. Ele vota leis, analisa propostas que afetam o país, fiscaliza o governo e participa de decisões importantes, como sabatinas de autoridades.",
  },
  {
    intent: "ExplicarChatbot",
    termos: ["para que serve o chatbot", "o que o chatbot faz", "o que voce faz", "como voce ajuda", "chatbot serve para que"],
    reply:
      "Eu ajudo a consultar informações políticas de forma simples. Você pode perguntar sobre parlamentares, projetos de lei e conceitos básicos da política brasileira.",
  },
  {
    intent: "ExplicarUso",
    termos: ["como usar", "como eu uso", "o que posso perguntar", "exemplos de perguntas"],
    reply:
      "Você pode perguntar de forma direta. Exemplos: 'Quem é Erika Hilton?', 'Me fale sobre PL 2630/2020', 'O que é uma PEC?' ou 'O que faz um deputado?'.",
  },
];

function buscarRespostaPronta(message) {
  const texto = normalizarTexto(message);

  return respostasProntas.find(({ termos }) =>
    termos.some((termo) => texto.includes(termo))
  );
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

  const respostaPronta = buscarRespostaPronta(message);

  if (respostaPronta) {
    return {
      intent: respostaPronta.intent,
      reply: respostaPronta.reply,
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
      "Ainda não entendi sua pergunta. Tente perguntar por um político, por um projeto como PL 2630/2020 ou por conceitos como PEC e deputado.",
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
      fulfillmentText: "Intent não reconhecida.",
    });
  } catch (error) {
    console.error(error);

    return res.json({
      fulfillmentText: "Erro ao consultar dados políticos.",
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
