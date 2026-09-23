const express = require("express");
const dotenv = require("dotenv");

const { buscarDeputado, buscarProjetoLei } = require("./services/camara");
const { buscarSenador } = require("./services/senado");
const { gerarRespostaComIA } = require("./services/ai");

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
  return [
    `Encontrei ${politico.nome} em uma fonte oficial.`,
    "",
    `${politico.nome} é ${politico.tipo}, do partido ${politico.partido}, e representa ${politico.uf}.`,
    "",
    `Fonte: ${politico.source.title}.`,
  ].join("\n");
}

function formatarProjeto(projeto) {
  const partes = [
    `Encontrei ${projeto.tipo} ${projeto.numero}/${projeto.ano} na base oficial da Câmara dos Deputados.`,
    "",
    `Ementa: ${projeto.ementa}`,
  ];

  if (projeto.situacao) {
    partes.push("", `Situação atual: ${projeto.situacao}.`);
  }

  if (projeto.autores?.length) {
    partes.push("", `Autor(es): ${projeto.autores.join(", ")}.`);
  }

  if (projeto.dataApresentacao) {
    partes.push("", `Data de apresentação: ${projeto.dataApresentacao}.`);
  }

  partes.push("", `Fonte: ${projeto.source.title}.`);

  return partes.join("\n");
}

function criarResposta({ intent, reply, dados = null, sources = [] }) {
  return {
    intent,
    reply,
    dados,
    sources,
  };
}

async function consultarPolitico(nome) {
  if (!nome) {
    return criarResposta({
      intent: "BuscarPolitico",
      reply: "Informe o nome do político que você quer consultar.",
    });
  }

  let politico = await buscarDeputado(nome);

  if (!politico) {
    politico = await buscarSenador(nome);
  }

  if (!politico) {
    return criarResposta({
      intent: "BuscarPolitico",
      reply:
        "Não encontrei esse político nas listas atuais consultadas da Câmara ou do Senado. Tente informar o nome parlamentar completo.",
    });
  }

  return criarResposta({
    intent: "BuscarPolitico",
    reply: formatarPolitico(politico),
    dados: politico,
    sources: [politico.source],
  });
}

async function responderPolitico(nome) {
  return (await consultarPolitico(nome)).reply;
}

async function consultarProjetoLei({ tipo = "PL", numero, ano }) {
  const numeroProjeto = Number(getFirst(numero));
  const anoProjeto = Number(getFirst(ano));
  const tipoProjeto = String(tipo || "PL").toUpperCase();

  if (!numeroProjeto || !anoProjeto) {
    return criarResposta({
      intent: "BuscarProjetoLei",
      reply:
        "Para consultar uma proposta específica, informe o tipo, número e ano. Exemplo: PL 2630/2020 ou PEC 45/2019.",
    });
  }

  const projeto = await buscarProjetoLei(
    tipoProjeto,
    numeroProjeto,
    anoProjeto
  );

  if (!projeto) {
    return criarResposta({
      intent: "BuscarProjetoLei",
      reply:
        `Não encontrei ${tipoProjeto} ${numeroProjeto}/${anoProjeto} na base consultada da Câmara dos Deputados.`,
    });
  }

  return criarResposta({
    intent: "BuscarProjetoLei",
    reply: formatarProjeto(projeto),
    dados: projeto,
    sources: [projeto.source],
  });
}

async function responderProjetoLei(projeto) {
  return (await consultarProjetoLei(projeto)).reply;
}

const respostasProntas = [
  {
    intent: "ExplicarPEC",
    termos: [
      "o que e uma pec",
      "o que e pec",
      "oque e pec",
      "pec significa",
      "me fale sobre uma pec",
      "fale sobre uma pec",
      "me fale sobre pec",
      "explique pec",
    ],
    reply:
      "Uma PEC é uma Proposta de Emenda à Constituição. Ela serve para alterar algum ponto da Constituição Federal. Diferente de um projeto de lei comum, uma PEC tem uma tramitação mais rígida e precisa de apoio maior no Congresso. Se quiser consultar uma proposta específica, pergunte algo como: 'Me fale sobre a PEC 45/2019'.",
  },
  {
    intent: "ExplicarProjetoLei",
    termos: [
      "o que e projeto de lei",
      "o que e um projeto de lei",
      "projeto de lei",
      "me fale sobre um projeto de lei",
      "fale sobre projeto de lei",
    ],
    reply:
      "Um projeto de lei é uma proposta para criar, alterar ou revogar uma lei. Ele precisa ser discutido e votado pelo Poder Legislativo. Se for aprovado nas etapas necessárias e sancionado quando couber, pode virar lei. Para consultar um projeto específico, use tipo, número e ano, como: PL 2630/2020.",
  },
  {
    intent: "ExplicarDeputado",
    termos: [
      "o que um deputado faz",
      "o que faz um deputado",
      "funcao de um deputado",
      "para que serve um deputado",
      "me fale sobre deputado",
      "fale sobre deputado",
    ],
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

function respostaProntaParaResponse(respostaPronta) {
  return criarResposta({
    intent: respostaPronta.intent,
    reply: respostaPronta.reply,
  });
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
    return consultarProjetoLei(projeto);
  }

  const respostaPronta = buscarRespostaPronta(message);

  if (respostaPronta) {
    return respostaProntaParaResponse(respostaPronta);
  }

  const nomePolitico = extrairNomePolitico(message);

  if (nomePolitico) {
    return consultarPolitico(nomePolitico);
  }

  return criarResposta({
    intent: "Fallback",
    reply:
      "Ainda não entendi totalmente sua pergunta. Posso ajudar com conceitos políticos, parlamentares e projetos. Tente, por exemplo: 'O que é uma PEC?', 'Quem é Erika Hilton?' ou 'Me fale sobre PL 2630/2020'.",
  });
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
    let reply = response.reply;
    let mode = "template";

    try {
      const aiReply = await gerarRespostaComIA({
        pergunta: message,
        intent: response.intent,
        respostaBase: response.reply,
        dados: response.dados,
        fontes: response.sources,
      });

      if (aiReply) {
        reply = aiReply;
        mode = "ai";
      }
    } catch (error) {
      console.warn("IA indisponível, usando resposta base.", error.message);
    }

    return res.json({
      reply,
      intent: response.intent,
      sources: response.sources,
      mode,
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
