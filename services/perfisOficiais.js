function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const perfisOficiais = [
  {
    nome: "Luiz Inácio Lula da Silva",
    nomePopular: "Lula",
    tipo: "Perfil político oficial",
    aliases: [
      "lula",
      "presidente lula",
      "luiz inacio lula",
      "luiz inacio lula da silva",
    ],
    resumo:
      "Luiz Inácio Lula da Silva, conhecido como Lula, é uma figura política brasileira. Foi dirigente sindical, participou da fundação do Partido dos Trabalhadores (PT) e foi eleito deputado federal constituinte em 1986. Foi eleito presidente em 2002 e tomou posse para seu terceiro mandato presidencial em 1º de janeiro de 2023.",
    observacao:
      "O nome Lula, neste perfil, identifica Luiz Inácio Lula da Silva e não Lula da Fonte. São marcos históricos; esta base não confirma cargo, partido ou situação eleitoral atual.",
    source: {
      title: "Agência Senado — Trajetória de Lula (01/01/2003)",
      url: "https://www12.senado.leg.br/noticias/materias/2003/01/01/do-agreste-ao-planalto-central-a-trajetoria-do-novo-presidente-da-republica-1068829318",
    },
    additionalSources: [{ title: "Agência Senado — Posse de Lula (01/01/2023)", url: "https://www12.senado.leg.br/noticias/materias/2023/01/01/congresso-empossa-lula-e-alckmin-na-presidencia-da-republica" }],
  },
  {
    nome: "Jair Messias Bolsonaro", nomePopular: "Jair Bolsonaro", tipo: "Perfil político oficial",
    aliases: ["bolsonaro", "jair bolsonaro", "jair messias bolsonaro", "presidente bolsonaro", "ex-presidente bolsonaro"],
    resumo: "Jair Messias Bolsonaro é uma figura política brasileira com carreira militar anterior à atuação parlamentar. Foi vereador no Rio de Janeiro e exerceu sete mandatos como deputado federal antes de assumir a Presidência da República em janeiro de 2019. Exerceu a Presidência no período de 2019 a 2022.",
    observacao: "São marcos históricos de sua trajetória institucional; esta base não confirma filiação, cargo, situação eleitoral ou judicial atual.",
    source: { title: "Câmara — Perfil de Jair Bolsonaro na posse (01/01/2019)", url: "https://www.camara.leg.br/radio/radioagencia/550435-conheca-perfil-do-presidente-da-republica-jair-bolsonaro/" },
    additionalSources: [{ title: "Ministério das Relações Exteriores — Presidência de Jair Bolsonaro (2019–2022)", url: "https://www.gov.br/mre/pt-br/centrais-de-conteudo/publicacoes/discursos-artigos-e-entrevistas/presidente-da-republica/presidente-da-republica-federativa-do-brasil-discursos/jair-messias-bolsonaro-2019-2022" }],
  },
];

function buscarPerfilOficial(nomeBusca) {
  const busca = normalizarTexto(nomeBusca);

  if (!busca) return null;

  return perfisOficiais.find((perfil) =>
    perfil.aliases.some((alias) => normalizarTexto(alias) === busca)
  ) || null;
}

module.exports = { buscarPerfilOficial };
