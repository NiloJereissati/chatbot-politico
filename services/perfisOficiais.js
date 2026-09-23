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
    partido: "PT",
    cargo: "Presidente da República",
    aliases: [
      "lula",
      "presidente lula",
      "luiz inacio lula",
      "luiz inacio lula da silva",
    ],
    resumo:
      "Você está se referindo a Luiz Inácio Lula da Silva, conhecido como Lula. Ele é uma liderança política brasileira do Partido dos Trabalhadores (PT) e ocupa a Presidência da República no mandato iniciado em 2023.",
    observacao:
      "Este perfil é tratado separadamente para evitar confusão com parlamentares que também usam Lula no nome parlamentar, como Lula da Fonte.",
    source: {
      title: "Palácio do Planalto - Biografia do Presidente",
      url: "https://www.gov.br/planalto/pt-br/conheca-a-presidencia/biografia-do-presidente",
    },
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
