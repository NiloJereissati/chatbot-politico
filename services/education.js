// Paraphrases of the official pages, reviewed on 2026-11-14; not live data.
const REVIEWED_AT = "2026-11-14";
const LES_URL = "https://www12.senado.leg.br/jovemsenador/home/paginas/como-sao-feitas-as-leis";
const topics = [
  {
    id: "pec", matches: /\bpec\b|emenda.{0,20}constitu/,
    text: "Uma PEC propõe mudar a Constituição. Sua aprovação exige dois turnos em cada Casa do Congresso e três quintos dos membros em cada votação. A emenda é promulgada pelas Mesas da Câmara e do Senado, sem sanção presidencial. Existem limites constitucionais à alteração da Constituição.",
    source: { title: "Senado Federal — Como são feitas as leis (PEC)", url: LES_URL },
  },
  {
    id: "leis", matches: /projeto.{0,12}lei|\bleis? federais?\b|processo legislativo|aprovacao.{0,15}lei/,
    text: "Um projeto de lei propõe criar, modificar ou revogar uma lei. Em linhas gerais, passa pela análise das comissões e pela apreciação das duas Casas do Congresso; alterações da Casa revisora podem retornar à Casa de origem. Concluída a apreciação parlamentar, há sanção ou veto presidencial quando cabível, seguida de promulgação e publicação. Há ritos e exceções conforme a matéria; aprovação parlamentar não significa automaticamente entrada em vigor.",
    source: { title: "Senado Federal — Como são feitas as leis", url: LES_URL },
  },
  {
    id: "congresso", matches: /congresso|camara|senad|deputad|poder legislativo/,
    text: "O Congresso Nacional reúne Câmara dos Deputados e Senado Federal. Deputados representam o povo; senadores representam os estados e o Distrito Federal. Ambas as Casas participam da elaboração de leis e da fiscalização do Executivo. A Câmara autoriza a instauração de determinados processos por crime de responsabilidade e o Senado possui competências para processar e julgar autoridades nos casos previstos na Constituição, além de apreciar certas indicações de autoridades. As atribuições das duas Casas não são idênticas.",
    source: { title: "Senado Verifica — Diferenças entre Senado e Câmara", url: "https://www12.senado.leg.br/verifica/materias-especiais/2026/qual-a-diferenca-entre-o-senado-e-a-camara-dos-deputados" },
  },
];
function educationalResponse(message) {
  const text = String(message).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!/^(?:o que|oque|oq|o q|como|qual|quais|explique|compare|descreva|por que|me explique|quero entender|pode explicar)\b/.test(text)) return null;
  // Keep entity/current-data questions on the existing official API routes.
  if (/\d|\b(atual|atuais|hoje|agora|candidato|candidatos|candidatura|eleitos|eleicoes|bens|patrimonio|ibge|municipio|municipios|contratos|licitacoes)\b/.test(text)) return null;
  if (/ignore|instrucoes|prompt|propaganda|em quem votar|vote em|melhor partido|melhor candidato|convenca|receita|futebol/.test(text)) return null;
  const selected = topics.filter(topic => topic.matches.test(text));
  if (!selected.length) return null;
  const sources = [...new Map(selected.map(topic => [topic.source.url, topic.source])).values()];
  if (selected.some(topic => topic.id === "pec")) sources.push({
    title: "Presidência da República — Manual de Redação, processo legislativo (2018)",
    url: "https://www.gov.br/cvm/pt-br/assuntos/noticias/anexos/2020/20201222_Manual_Redacao_Presidencia.pdf",
  });
  const limitation = `Síntese educativa revisada em ${REVIEWED_AT}, baseada nas fontes indicadas. Não informa a tramitação atual de uma proposta nem substitui a consulta ao texto constitucional e aos regimentos.`;
  return {
    intent: "ExplicarInstituicoes", reply: `${selected.map(topic => topic.text).join("\n\n")}\n\n${limitation}`,
    dados: { tipo: "base_educativa_revisada", revisadoEm: REVIEWED_AT, topicos: selected.map(({ id, text }) => ({ id, text })), limitacoes: limitation }, sources,
  };
}
module.exports = { educationalResponse, REVIEWED_AT };
