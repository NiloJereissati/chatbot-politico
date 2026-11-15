// Paraphrases of the official pages, reviewed on 2026-11-14; not live data.
const REVIEWED_AT = "2026-11-14";
const { normalizeQuestion, blockedRequest, extractPoliticalName } = require("./politicalLanguage");
const LES_URL = "https://www12.senado.leg.br/jovemsenador/home/paginas/como-sao-feitas-as-leis";
const CONSTITUTION = "https://www2.camara.leg.br/legin/fed/consti/1988/constituicao-1988-5-outubro-1988-322142-normaatualizada-pl.html";
const topics = [
  {
    id: "pec", matches: /\bpec\b|emenda.{0,20}constitu/,
    text: "Uma PEC propõe mudar a Constituição. Sua aprovação exige dois turnos em cada Casa do Congresso e três quintos dos membros em cada votação. A emenda é promulgada pelas Mesas da Câmara e do Senado, sem sanção presidencial. Existem limites constitucionais à alteração da Constituição.",
    source: { title: "Senado Federal — Como são feitas as leis (PEC)", url: LES_URL },
  },
  {
    id: "leis", matches: /projeto.{0,12}lei|\bleis? federais?\b|processo legislativo|(?:aprovacao|tramitacao|aprovad[ao]|cria).{0,25}lei/,
    text: "Um projeto de lei propõe criar, modificar ou revogar uma lei. Em linhas gerais, passa pela análise das comissões e pela apreciação das duas Casas do Congresso; alterações da Casa revisora podem retornar à Casa de origem. Concluída a apreciação parlamentar, há sanção ou veto presidencial quando cabível, seguida de promulgação e publicação. Há ritos e exceções conforme a matéria; aprovação parlamentar não significa automaticamente entrada em vigor.",
    source: { title: "Senado Federal — Como são feitas as leis", url: LES_URL },
  },
  {
    id: "congresso", matches: /congresso|camara|senad|deputad|poder legislativo/,
    text: "O Congresso Nacional reúne Câmara dos Deputados e Senado Federal. Deputados representam o povo; senadores representam os estados e o Distrito Federal. Ambas as Casas participam da elaboração de leis e da fiscalização do Executivo. A Câmara autoriza a instauração de determinados processos por crime de responsabilidade e o Senado possui competências para processar e julgar autoridades nos casos previstos na Constituição, além de apreciar certas indicações de autoridades. As atribuições das duas Casas não são idênticas.",
    source: { title: "Senado Verifica — Diferenças entre Senado e Câmara", url: "https://www12.senado.leg.br/verifica/materias-especiais/2026/qual-a-diferenca-entre-o-senado-e-a-camara-dos-deputados" },
  },
  {
    id: "poderes", matches: /\bpoderes\b|poder (?:executivo|judiciario)|\bpresidente\b|\bgovernador\b|\bprefeito\b|\bstf\b/,
    text: "A Constituição separa os Poderes Legislativo, Executivo e Judiciário, independentes e harmônicos. No plano federal, o Congresso exerce o Legislativo; o presidente da República exerce o Executivo, com auxílio dos ministros; o Judiciário exerce a função jurisdicional. O Executivo administra e executa políticas públicas, o Legislativo elabora leis e fiscaliza, e o Judiciário julga conflitos nos limites constitucionais. Estados e municípios têm competências próprias: governador e prefeito chefiam seus respectivos Executivos. Nem todos os entes têm a mesma estrutura; municípios não possuem Judiciário próprio. Esta síntese não identifica os atuais ocupantes de cargos.",
    source: { title: "Câmara — Constituição Federal, arts. 2, 18, 29, 44, 76, 84 e 92", url: CONSTITUTION },
  },
  {
    id: "constituicao", matches: /\bconstituicao\b|\bdemocracia\b|\brepublica\b|\bcidadania\b/,
    text: "A Constituição organiza o Estado e estabelece direitos, garantias e competências das instituições. O Brasil é uma República federativa e um Estado democrático de direito. O poder emana do povo, exercido por representantes eleitos ou diretamente nos termos constitucionais. Federação distribui competências entre União, estados, Distrito Federal e municípios; democracia envolve participação política, pluralismo e respeito aos direitos. A cidadania é um fundamento constitucional. Esta explicação é introdutória, não orientação jurídica para um caso individual.",
    source: { title: "Câmara — Constituição Federal, arts. 1, 5 e 18", url: CONSTITUTION },
  },
  {
    id: "partidos", matches: /\bpartidos? politicos?\b|(?:o que|significa|funcionam|funciona|serve).{0,25}\bpartidos?\b/,
    text: "Partidos políticos são organizações permanentes que participam da representação política e apresentam candidaturas conforme as regras eleitorais. Sua criação e funcionamento devem respeitar o regime democrático, o pluripartidarismo e os direitos fundamentais. Federação e coligação são formas distintas de união entre partidos, com regras próprias. Esta base explica o conceito, mas não contém cadastro atualizado de dirigentes, filiações ou programas de cada sigla.",
    source: { title: "TSE — Diferenças entre partido, federação e coligação (2026)", url: "https://www.tse.jus.br/comunicacao/noticias/2026/Junho/por-dentro-das-eleicoes-entenda-as-diferencas-entre-partido-federacao-e-coligacao" },
  },
  {
    id: "ideologias", matches: /\besquerda\b|\bdireita\b|\bideologias?\b|espectro politico/,
    text: "Esquerda e direita são termos do espectro político, cujos significados variam entre sociedades, épocas e temas. Em termos gerais, a esquerda enfatiza a redução de desigualdades sociais; a direita inclui tradições conservadoras e liberais e, nas democracias liberais, se contrapõe ao socialismo e à social-democracia. Esses agrupamentos são diversos e não resumem todas as posições de uma pessoa. Não são notas de qualidade, e esta explicação não classifica partidos ou pessoas nem recomenda voto.",
    source: { title: "Senado — Vocabulário Controlado: direita (ciência política)", url: "https://adm.senado.leg.br/vcb/vocab/index.php?/direita-ciencia-politica=&tema=8592" },
    additionalSources: [{ title: "Senado — Vocabulário Controlado: esquerda (ciência política)", url: "https://adm.senado.leg.br/vcb/vocab/index.php?/esquerda-ciencia-politica=&tema=8131" }],
  },
];
function educationalResponse(message) {
  const text = normalizeQuestion(message);
  if (!/^(?:o que|oque|oq|o q|como|qual|quais|explique|explica|explicar|compare|comparar|descreva|descrever|por que|me (?:explique|explica|explicar|diz|diga|conte|fale)|quero entender|gostaria de entender|fale|conte)\b/.test(text)) return null;
  // Keep entity/current-data questions on the existing official API routes.
  if (/\d|\b(atual|atuais|hoje|agora|candidato|candidatos|candidatura|eleitos|eleicoes|bens|patrimonio|ibge|municipio|municipios|contratos|licitacoes)\b/.test(text)) return null;
  if (blockedRequest(text)) return null;
  const subject = extractPoliticalName(text);
  if (subject && !/^(?:congresso(?: nacional)?|camara(?: dos deputados)?|senado(?: federal)?|poder(?:es)?(?: da republica| executivo| judiciario| legislativo)?|constituicao(?: federal)?|democracia|republica|cidadania|partidos?(?: politicos)?|esquerda e direita|pec|projetos? de lei)$/.test(subject)) return null;
  // Named people and specific parties need their own evidence, not a generic
  // chapter that happens to mention their office or an ideological adjective.
  if (/\b(quem|biografia|trajetoria)\b/.test(text)) return null;
  if (/\b(?:do|da|sobre) (?:lula|bolsonaro|pt|pl|mdb|psol|psdb)\b/.test(text)) return null;
  const selected = topics.filter(topic => topic.matches.test(text));
  if (!selected.length) return null;
  const sources = [...new Map(selected.flatMap(topic => [topic.source, ...(topic.additionalSources || [])]).map(source => [source.url, source])).values()];
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
