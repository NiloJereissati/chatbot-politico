const express = require("express");
const dotenv = require("dotenv");

const { buscarDeputado, buscarProjetoLei } = require("./services/camara");
const { buscarSenador } = require("./services/senado");
const { gerarRespostaComIA } = require("./services/ai");
const { buscarPerfilOficial } = require("./services/perfisOficiais");
const {
  DEFAULT_TSE_YEAR,
  TSEDatasetTooLargeError,
  buscarCandidatoTSE,
} = require("./services/tse");
const {
  buscarEstadoIBGE,
  buscarMunicipioIBGE,
  buscarMunicipiosPorUfIBGE,
} = require("./services/ibge");
const {
  TransparenciaTokenMissingError,
  consultarContratos,
  consultarEmendas,
  consultarLicitacoes,
} = require("./services/transparencia");

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
    .replace(/\bvc\b/g, "voce")
    .replace(/\bce\b/g, "voce")
    .replace(/\btb\b/g, "tambem")
    .replace(/\bpq\b/g, "porque")
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

function formatarPerfilOficial(perfil) {
  return [
    perfil.resumo,
    "",
    `Nome oficial: ${perfil.nome}.`,
    `Nome popular: ${perfil.nomePopular}.`,
    `Partido: ${perfil.partido}.`,
    `Cargo: ${perfil.cargo}.`,
    "",
    perfil.observacao,
    "",
    `Fonte: ${perfil.source.title}.`,
  ].join("\n");
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarTitulo(texto) {
  return String(texto || "")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letra) => letra.toUpperCase());
}

function formatarCandidatoTSE(candidato) {
  const nomeExibicao = candidato.nomeUrna || candidato.nome;
  const partes = [
    `Encontrei ${nomeExibicao} na base oficial do TSE.`,
    "",
    `${nomeExibicao} concorreu em ${candidato.ano} ao cargo de ${formatarTitulo(candidato.cargo)}, pelo partido ${candidato.partido}, com o número ${candidato.numero}.`,
    `Nome completo: ${candidato.nome}.`,
  ];

  if (candidato.unidadeEleitoral && candidato.uf) {
    partes.push(`Unidade eleitoral: ${candidato.unidadeEleitoral} (${candidato.uf}).`);
  }

  if (candidato.situacaoCandidatura) {
    partes.push(`Situação da candidatura: ${formatarTitulo(candidato.situacaoCandidatura)}.`);
  }

  if (candidato.resultadoTurno) {
    partes.push(`Resultado informado no turno consultado: ${formatarTitulo(candidato.resultadoTurno)}.`);
  }

  partes.push(
    "",
    `Eleição: ${candidato.eleicao}${candidato.dataEleicao ? `, em ${candidato.dataEleicao}` : ""}.`
  );

  if (candidato.bens) {
    partes.push(
      "",
      `Bens declarados no TSE: ${candidato.bens.quantidade} item(ns), totalizando ${formatarMoeda(candidato.bens.valorTotal)}.`
    );

    if (candidato.bens.principais.length) {
      partes.push("Maiores itens declarados:");

      candidato.bens.principais.forEach((bem, index) => {
        partes.push(
          `${index + 1}. ${bem.tipo}: ${bem.descricao} (${formatarMoeda(bem.valor)}).`
        );
      });
    }
  } else {
    partes.push(
      "",
      `Se quiser ver bens declarados quando disponíveis, pergunte: "bens declarados de ${nomeExibicao} ${candidato.ano}".`
    );
  }

  partes.push("", `Fonte: ${candidato.source.title}.`);

  return partes.join("\n");
}

function formatarLocalidadeIBGE(localidade) {
  if (localidade.tipo === "Lista de municípios") {
    return [
      `Encontrei a lista de municípios de ${localidade.estado || localidade.uf} na base oficial do IBGE.`,
      "",
      `${localidade.estado || localidade.uf} possui ${localidade.quantidade} município(s) cadastrados na API de Localidades do IBGE.`,
      localidade.regiao ? `Região: ${localidade.regiao}.` : null,
      "",
      `Alguns exemplos: ${localidade.exemplos.join(", ")}.`,
      "",
      `Fonte: ${localidade.source.title}.`,
    ].filter(Boolean).join("\n");
  }

  if (localidade.tipo === "Estado") {
    return [
      `Encontrei ${localidade.nome} na base oficial do IBGE.`,
      "",
      `Tipo: estado.`,
      `Sigla: ${localidade.sigla}.`,
      `Código IBGE: ${localidade.id}.`,
      `Região: ${localidade.regiao} (${localidade.regiaoSigla}).`,
      "",
      `Fonte: ${localidade.source.title}.`,
    ].join("\n");
  }

  return [
    `Encontrei ${localidade.nome} na base oficial do IBGE.`,
    "",
    `Tipo: município.`,
    `Código IBGE: ${localidade.id}.`,
    `Estado: ${localidade.estado} (${localidade.uf}).`,
    `Região: ${localidade.regiao} (${localidade.regiaoSigla}).`,
    "",
    `Fonte: ${localidade.source.title}.`,
  ].join("\n");
}

function resumirValorTransparencia(valor) {
  if (typeof valor === "number") {
    return formatarMoeda(valor);
  }

  return valor || "não informado";
}

function formatarTransparencia(resultado) {
  const partes = [
    `Consultei ${resultado.tipo} no Portal da Transparência.`,
    "",
  ];

  if (resultado.dataInicial && resultado.dataFinal) {
    partes.push(`Período consultado: ${resultado.dataInicial} a ${resultado.dataFinal}.`);
  }

  if (resultado.ano) {
    partes.push(`Ano consultado: ${resultado.ano}.`);
  }

  if (resultado.autor) {
    partes.push(`Autor informado: ${resultado.autor}.`);
  }

  if (!resultado.itens.length) {
    partes.push("", "Não encontrei registros nos filtros consultados.");
  } else {
    partes.push("", "Primeiros registros encontrados:");

    resultado.itens.forEach((item, index) => {
      if (resultado.tipo === "Emendas parlamentares") {
        partes.push(
          `${index + 1}. ${item.codigoEmenda || item.numeroEmenda || "Emenda"} - ${item.nomeAutor || item.autor || "autor não informado"}: empenhado ${resumirValorTransparencia(item.valorEmpenhado)}, pago ${resumirValorTransparencia(item.valorPago)}.`
        );
        return;
      }

      if (resultado.tipo === "Contratos públicos") {
        partes.push(
          `${index + 1}. Contrato ${item.numero || item.id || "sem número"} - ${item.objeto || "objeto não informado"}; valor final ${resumirValorTransparencia(item.valorFinalCompra)}.`
        );
        return;
      }

      partes.push(
        `${index + 1}. Licitação ${item.licitacao?.numero || item.id || "sem número"} - ${item.modalidadeLicitacao || "modalidade não informada"}; valor ${resumirValorTransparencia(item.valor)}.`
      );
    });
  }

  partes.push("", `Fonte: ${resultado.source.title}.`);
  return partes.join("\n");
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

  const ultimaTramitacao = projeto.ultimasTramitacoes?.[0];

  if (ultimaTramitacao) {
    const data = formatarData(ultimaTramitacao.dataHora);
    partes.push(
      "",
      `Última tramitação localizada: ${data ? `${data} - ` : ""}${ultimaTramitacao.descricao || "tramitação registrada"}.`
    );
  }

  if (projeto.quantidadeVotacoes > 0) {
    const textoVotacoes =
      projeto.quantidadeVotacoes === 1
        ? "1 votação associada"
        : `${projeto.quantidadeVotacoes} votações associadas`;

    partes.push(
      "",
      `Também encontrei ${textoVotacoes}. Para ver detalhes, pergunte: "Como foi a votação da ${projeto.tipo} ${projeto.numero}/${projeto.ano}?".`
    );
  }

  partes.push("", `Fonte: ${projeto.source.title}.`);

  return partes.join("\n");
}

function formatarData(data) {
  if (!data) return null;

  const date = new Date(data);

  if (Number.isNaN(date.getTime())) {
    return data;
  }

  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatarTramitacoesProjeto(projeto) {
  const partes = [
    `Encontrei ${projeto.tipo} ${projeto.numero}/${projeto.ano} na base oficial da Câmara dos Deputados.`,
    "",
  ];

  if (!projeto.ultimasTramitacoes?.length) {
    partes.push("Não encontrei registros recentes de tramitação para essa proposição nos dados consultados.");
  } else {
    partes.push("Últimas tramitações encontradas:");

    projeto.ultimasTramitacoes.forEach((tramitacao, index) => {
      const data = formatarData(tramitacao.dataHora);
      const descricao = tramitacao.descricao || "tramitação registrada";
      const orgao = tramitacao.orgao ? ` no órgão ${tramitacao.orgao}` : "";
      const despacho = tramitacao.despacho ? ` Despacho: ${tramitacao.despacho}` : "";

      partes.push(
        `${index + 1}. ${data ? `${data}: ` : ""}${descricao}${orgao}.${despacho}`
      );
    });
  }

  partes.push("", `Fonte: ${projeto.source.title}.`);
  return partes.join("\n");
}

function formatarVotacoesProjeto(projeto) {
  const partes = [
    `Encontrei ${projeto.tipo} ${projeto.numero}/${projeto.ano} na base oficial da Câmara dos Deputados.`,
    "",
  ];

  if (!projeto.ultimasVotacoes?.length) {
    partes.push("Não encontrei votações associadas a essa proposição nos dados consultados.");
  } else {
    partes.push("Votações mais recentes encontradas:");

    projeto.ultimasVotacoes.forEach((votacao, index) => {
      const data = formatarData(votacao.data);
      const orgao = votacao.orgao ? ` - ${votacao.orgao}` : "";
      const resultado = String(votacao.resultado || votacao.descricao || "resultado não informado")
        .replace(/[.\s]+$/g, "");
      const placar = [
        votacao.placarSim != null ? `sim: ${votacao.placarSim}` : null,
        votacao.placarNao != null ? `não: ${votacao.placarNao}` : null,
        votacao.placarAbstencao != null ? `abstenção: ${votacao.placarAbstencao}` : null,
      ].filter(Boolean);

      partes.push(
        `${index + 1}. ${data ? `${data}${orgao}: ` : ""}${resultado}${placar.length ? ` (${placar.join(", ")})` : ""}.`
      );
    });
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

function consultarPerfilOficial(nome) {
  const perfil = buscarPerfilOficial(nome);

  if (!perfil) {
    return null;
  }

  return criarResposta({
    intent: "BuscarPerfilOficial",
    reply: formatarPerfilOficial(perfil),
    dados: perfil,
    sources: [perfil.source],
  });
}

async function consultarCandidatoTSE(consulta) {
  try {
    const candidato = await buscarCandidatoTSE(consulta);

    if (!candidato) {
      return criarResposta({
        intent: "BuscarCandidatoTSE",
        reply:
          `Não encontrei esse candidato na base oficial do TSE para ${consulta.ano || DEFAULT_TSE_YEAR}. Tente informar nome de urna, ano e cargo. Exemplo: "candidato Lula 2022".`,
        sources: [
          {
            title: `Portal de Dados Abertos do TSE - Candidatos ${consulta.ano || DEFAULT_TSE_YEAR}`,
            url: `https://dadosabertos.tse.jus.br/dataset/candidatos-${consulta.ano || DEFAULT_TSE_YEAR}`,
          },
        ],
      });
    }

    const sources = [candidato.source];

    if (candidato.bens?.source) {
      sources.push(candidato.bens.source);
    }

    return criarResposta({
      intent: consulta.incluirBens ? "BuscarBensCandidatoTSE" : "BuscarCandidatoTSE",
      reply: formatarCandidatoTSE(candidato),
      dados: candidato,
      sources,
    });
  } catch (error) {
    if (error instanceof TSEDatasetTooLargeError) {
      return criarResposta({
        intent: "BuscarCandidatoTSE",
        reply:
          `A base de candidatos do TSE para ${error.ano} é grande demais para consulta ao vivo neste MVP. Para esse ano, o ideal é preparar um cache/banco de dados no backend antes de liberar a consulta no chat.`,
        sources: [
          {
            title: `Portal de Dados Abertos do TSE - Candidatos ${error.ano}`,
            url: `https://dadosabertos.tse.jus.br/dataset/candidatos-${error.ano}`,
          },
        ],
      });
    }

    throw error;
  }
}

async function consultarLocalidadeIBGE(consulta) {
  let localidade = null;

  if (consulta.tipo === "municipiosPorUf") {
    const estado = await buscarEstadoIBGE(consulta.uf);
    localidade = await buscarMunicipiosPorUfIBGE(estado?.sigla || consulta.uf);
  } else if (consulta.tipo === "estado") {
    localidade = await buscarEstadoIBGE(consulta.nome);
  } else {
    localidade = await buscarMunicipioIBGE(consulta.nome, consulta.uf);
  }

  if (!localidade) {
    return criarResposta({
      intent: "BuscarLocalidadeIBGE",
      reply:
        "Não encontrei essa localidade na API oficial de Localidades do IBGE. Tente informar o nome completo do município ou a sigla do estado, como 'Fortaleza CE' ou 'municípios do CE'.",
      sources: [
        {
          title: "IBGE - API de Localidades",
          url: "https://servicodados.ibge.gov.br/api/docs/localidades",
        },
      ],
    });
  }

  return criarResposta({
    intent: "BuscarLocalidadeIBGE",
    reply: formatarLocalidadeIBGE(localidade),
    dados: localidade,
    sources: [localidade.source],
  });
}

async function consultarTransparenciaPublica(consulta) {
  try {
    const resultado =
      consulta.tipo === "emendas"
        ? await consultarEmendas(consulta)
        : consulta.tipo === "licitacoes"
          ? await consultarLicitacoes(consulta)
          : await consultarContratos(consulta);

    return criarResposta({
      intent: "BuscarTransparencia",
      reply: formatarTransparencia(resultado),
      dados: resultado,
      sources: [resultado.source],
    });
  } catch (error) {
    if (error instanceof TransparenciaTokenMissingError) {
      return criarResposta({
        intent: "BuscarTransparencia",
        reply:
          "A integração com o Portal da Transparência já está preparada, mas ainda falta configurar o token oficial no Render. Depois de cadastrar a chave no Portal da Transparência, adicione a variável PORTAL_TRANSPARENCIA_API_KEY no serviço do backend.",
        sources: [
          {
            title: "Portal da Transparência - API de Dados",
            url: "https://portaldatransparencia.gov.br/api-de-dados",
          },
          {
            title: "Portal da Transparência - Cadastro de token",
            url: "https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email",
          },
        ],
      });
    }

    throw error;
  }
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

function detectarFocoProjeto(message) {
  const texto = normalizarTexto(message);

  if (/\b(votacao|votacoes|votou|votaram|aprovado|aprovacao|placar)\b/.test(texto)) {
    return "votacoes";
  }

  if (/\b(tramitacao|tramitacoes|tramita|andamento|situacao|status)\b/.test(texto)) {
    return "tramitacoes";
  }

  return "resumo";
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
    termos: [
      "para que serve o chatbot",
      "o que o chatbot faz",
      "o que voce faz",
      "oq voce faz",
      "o que vc faz",
      "oq vc faz",
      "quem e voce",
      "quem e vc",
      "como voce ajuda",
      "como vc ajuda",
      "chatbot serve para que",
      "qual sua funcao",
      "qual e sua funcao",
    ],
    reply:
      "Eu sou um chatbot político. Posso ajudar você a entender conceitos como PEC e projeto de lei, consultar parlamentares e buscar informações oficiais sobre proposições, tramitações e votações.\n\nExemplos de perguntas:\n- O que é uma PEC?\n- Quem é Erika Hilton?\n- Me fale sobre PL 2630/2020\n- Qual a tramitação da PEC 45/2019?\n- Como foi a votação da PEC 45/2019?",
  },
  {
    intent: "ExplicarTSE",
    termos: [
      "o que e o tse",
      "o que e tse",
      "para que serve o tse",
      "dados do tse",
      "dados eleitorais do tse",
    ],
    reply:
      "O TSE é o Tribunal Superior Eleitoral. No chatbot, eu uso o Portal de Dados Abertos do TSE para consultar informações oficiais sobre candidaturas e, quando disponível, bens declarados. Exemplos: 'candidato Lula 2022' ou 'bens declarados de Lula 2022'.",
  },
  {
    intent: "ExplicarFontesOficiais",
    termos: [
      "quais fontes voce usa",
      "quais apis voce usa",
      "fontes oficiais",
      "api do ibge",
      "portal da transparencia",
    ],
    reply:
      "Eu uso fontes oficiais como Câmara dos Deputados, Senado Federal, TSE, IBGE, gov.br/Planalto e Portal da Transparência. Algumas consultas são diretas; o Portal da Transparência exige token oficial no backend. Exemplos: 'municípios do CE', 'candidato Lula 2022' ou 'emendas parlamentares 2024'.",
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

function extrairAnoEleitoral(message) {
  const match = String(message || "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : DEFAULT_TSE_YEAR;
}

function detectarCargoEleitoral(message) {
  const texto = normalizarTexto(message);
  const cargos = [
    { cargo: "PRESIDENTE", termos: ["presidente", "presidencia"] },
    { cargo: "GOVERNADOR", termos: ["governador", "governadora", "governo estadual"] },
    { cargo: "SENADOR", termos: ["senador", "senadora", "senado"] },
    { cargo: "DEPUTADO FEDERAL", termos: ["deputado federal", "deputada federal"] },
    { cargo: "DEPUTADO ESTADUAL", termos: ["deputado estadual", "deputada estadual"] },
    { cargo: "DEPUTADO DISTRITAL", termos: ["deputado distrital", "deputada distrital"] },
    { cargo: "PREFEITO", termos: ["prefeito", "prefeita"] },
    { cargo: "VEREADOR", termos: ["vereador", "vereadora"] },
  ];

  const cargo = cargos.find(({ termos }) =>
    termos.some((termo) => texto.includes(termo))
  );

  return cargo?.cargo || null;
}

function detectarUfEleitoral(message) {
  const match = String(message || "")
    .toUpperCase()
    .match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO|BR)\b/);

  return match?.[1] || null;
}

function detectarFocoTSE(message) {
  const texto = normalizarTexto(message);

  if (/\b(bem|bens|patrimonio|declarou|declarados|declaradas)\b/.test(texto)) {
    return "bens";
  }

  return "candidatura";
}

function limparNomeConsultaTSE(nome, cargo) {
  let texto = normalizarTexto(nome)
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b(no|na|nos|nas|em|de|do|da|dos|das|sobre|para|como)\b/g, " ")
    .replace(/\b(tse|eleicao|eleicoes|eleitoral|eleitorais|candidato|candidata|candidatura)\b/g, " ")
    .replace(/\b(bem|bens|patrimonio|declarado|declarada|declarados|declaradas)\b/g, " ");

  if (cargo) {
    texto = texto.replace(new RegExp(`\\b${normalizarTexto(cargo)}\\b`, "g"), " ");
  }

  return texto.replace(/\s+/g, " ").trim();
}

function extrairConsultaTSE(message) {
  const texto = normalizarTexto(message).replace(/[?!.,;:]+$/g, "");
  const hasTrigger =
    /\b(tse|eleicao|eleicoes|eleitoral|eleitorais|candidato|candidata|candidatura)\b/.test(texto) ||
    /\b(bens|patrimonio)\b/.test(texto);

  if (!hasTrigger) {
    return null;
  }

  const cargo = detectarCargoEleitoral(message);
  const patterns = [
    /^(?:dados\s+eleitorais|informacoes\s+eleitorais|dados\s+do\s+tse)\s+(?:de|do|da|sobre)\s+(.+)$/,
    /^(?:bens\s+declarados|patrimonio)\s+(?:de|do|da)\s+(.+)$/,
    /^(?:candidato|candidata|candidatura)\s+(?:de|do|da)?\s*(.+)$/,
    /^(?:me\s+fale\s+sobre|fale\s+sobre|quem\s+e|quem\s+foi)\s+(.+?)\s+(?:no\s+tse|nas\s+eleicoes|na\s+eleicao|como\s+candidat[oa]|candidat[oa]|eleitoral)/,
    /^(.+?)\s+(?:no\s+tse|nas\s+eleicoes|na\s+eleicao|como\s+candidat[oa]|candidat[oa]\s+em)/,
  ];

  for (const pattern of patterns) {
    const match = texto.match(pattern);

    if (match) {
      const nome = limparNomeConsultaTSE(match[1], cargo);

      if (nome.length >= 2) {
        return {
          nome,
          ano: extrairAnoEleitoral(message),
          cargo,
          uf: detectarUfEleitoral(message),
          incluirBens: detectarFocoTSE(message) === "bens",
        };
      }
    }
  }

  return null;
}

function extrairAno(message, fallback = new Date().getFullYear()) {
  const match = String(message || "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : fallback;
}

function extrairCodigoOrgao(message) {
  const texto = normalizarTexto(message);
  const match = texto.match(/\b(?:orgao|codigo\s+do\s+orgao|codigo\s+orgao)\s+(\d{3,})\b/);
  return match?.[1] || null;
}

function limparNomeConsultaIBGE(nome) {
  return normalizarTexto(nome)
    .replace(/\b(ibge|municipio|municipios|cidade|cidades|estado|estados|localidade|localidades|regiao|regioes|dados|informacoes|sobre|do|da|de|dos|das|no|na)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairConsultaIBGE(message) {
  const texto = normalizarTexto(message).replace(/[?!.,;:]+$/g, "");
  const temGatilho =
    /\b(ibge|municipio|municipios|cidade|cidades|estado|estados|localidade|localidades|regiao)\b/.test(texto);

  if (!temGatilho) {
    return null;
  }

  const uf = detectarUfEleitoral(message);

  const listaUf = texto.match(/\bmunicipios\s+(?:do|da|de|em|no|na)\s+(.+)$/);
  if (listaUf) {
    const nome = limparNomeConsultaIBGE(listaUf[1]);
    return {
      tipo: "municipiosPorUf",
      uf: uf || nome,
    };
  }

  const estadoMatch = texto.match(/\b(?:estado|regiao)\s+(?:do|da|de)?\s*(.+)$/);
  if (estadoMatch) {
    const nome = limparNomeConsultaIBGE(estadoMatch[1]);
    return {
      tipo: "estado",
      nome: uf || nome,
    };
  }

  const municipioPatterns = [
    /^(?:dados|informacoes)\s+(?:do|da|de|sobre)\s+(.+?)\s+(?:no|na)\s+ibge$/,
    /^(?:municipio|cidade|localidade)\s+(?:do|da|de)?\s*(.+)$/,
    /^(.+?)\s+(?:no|na)\s+ibge$/,
  ];

  for (const pattern of municipioPatterns) {
    const match = texto.match(pattern);

    if (match) {
      const nome = limparNomeConsultaIBGE(match[1]);

      if (nome.length >= 2) {
        return {
          tipo: "municipio",
          nome,
          uf,
        };
      }
    }
  }

  return null;
}

function limparAutorEmenda(texto) {
  return normalizarTexto(texto)
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b(emenda|emendas|parlamentar|parlamentares|portal|transparencia|de|do|da|dos|das|sobre|autor|autora)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairConsultaTransparencia(message) {
  const texto = normalizarTexto(message).replace(/[?!.,;:]+$/g, "");
  const temGatilho =
    /\b(transparencia|emenda|emendas|contrato|contratos|licitacao|licitacoes|gasto|gastos|despesa|despesas)\b/.test(texto);

  if (!temGatilho) {
    return null;
  }

  const ano = extrairAno(message);
  const codigoOrgao = extrairCodigoOrgao(message);

  if (/\b(emenda|emendas)\b/.test(texto)) {
    const autorMatch = texto.match(/\bemendas?\s+(?:parlamentares?\s+)?(?:de|do|da|dos|das|por|autor|autora)?\s*(.*)$/);
    const autor = autorMatch ? limparAutorEmenda(autorMatch[1]) : "";

    return {
      tipo: "emendas",
      ano,
      autor: autor || undefined,
    };
  }

  if (/\b(licitacao|licitacoes)\b/.test(texto)) {
    return {
      tipo: "licitacoes",
      codigoOrgao,
    };
  }

  if (/\b(contrato|contratos|gasto|gastos|despesa|despesas|transparencia)\b/.test(texto)) {
    return {
      tipo: "contratos",
      codigoOrgao,
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
    const response = await consultarProjetoLei(projeto);
    const foco = detectarFocoProjeto(message);

    if (response.dados && foco === "votacoes") {
      return {
        ...response,
        intent: "BuscarVotacoesProjeto",
        reply: formatarVotacoesProjeto(response.dados),
      };
    }

    if (response.dados && foco === "tramitacoes") {
      return {
        ...response,
        intent: "BuscarTramitacaoProjeto",
        reply: formatarTramitacoesProjeto(response.dados),
      };
    }

    return response;
  }

  const respostaPronta = buscarRespostaPronta(message);

  if (respostaPronta) {
    return respostaProntaParaResponse(respostaPronta);
  }

  const consultaTSE = extrairConsultaTSE(message);

  if (consultaTSE) {
    return consultarCandidatoTSE(consultaTSE);
  }

  const consultaTransparencia = extrairConsultaTransparencia(message);

  if (consultaTransparencia) {
    return consultarTransparenciaPublica(consultaTransparencia);
  }

  const consultaIBGE = extrairConsultaIBGE(message);

  if (consultaIBGE) {
    return consultarLocalidadeIBGE(consultaIBGE);
  }

  const nomePolitico = extrairNomePolitico(message);

  if (nomePolitico) {
    const perfilOficial = consultarPerfilOficial(nomePolitico);

    if (perfilOficial) {
      return perfilOficial;
    }

    return consultarPolitico(nomePolitico);
  }

  return criarResposta({
    intent: "Fallback",
    reply:
      "Ainda não entendi totalmente sua pergunta. Posso ajudar com conceitos políticos, parlamentares e projetos. Tente, por exemplo: 'O que é uma PEC?', 'Quem é Erika Hilton?' ou 'Me fale sobre PL 2630/2020'.",
  });
}

function deveUsarIAControlada(response) {
  if (process.env.AI_ENABLED === "false") {
    return false;
  }

  if (!response?.dados || !response?.sources?.length) {
    return false;
  }

  if (response.intent === "Fallback") {
    return false;
  }

  return true;
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

    if (deveUsarIAControlada(response)) {
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
