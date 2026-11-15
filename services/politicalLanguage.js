// Deterministic routing: understanding a question must not spend a model call.
function normalizeQuestion(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim()
    .replace(/^(?:ola|oi|bom dia|boa tarde|boa noite)[!,.: ]+/, "")
    .replace(/^(?:por favor[, ]+|voce pode\s+|pode\s+|poderia\s+)/, "")
    .replace(/[?!.,;:]+$/g, "").trim();
}
function blockedRequest(message) {
  const text = normalizeQuestion(message);
  return /\b(ignore|ignorar|prompt|instrucoes|propaganda|convenca|persuada|receita|futebol|videogame|horoscopo|python|javascript)\b/.test(text) ||
    /em quem votar|vote em|melhor (?:partido|candidato|politico|presidente)|pior (?:partido|candidato|politico)|ranking|mais corrupto/.test(text);
}
function extractPoliticalName(message) {
  const text = normalizeQuestion(message);
  const patterns = [
    /^(?:(?:me )?(?:diz|diga|dizer|conte|contar|explica|explique|explicar)\s+)?quem (?:e|foi)\s+(.+)$/,
    /^(?:(?:me )?(?:fale|conte|diga|explique)|quero saber|gostaria de saber)\s+sobre\s+(.+)$/,
    /^(?:dados|informacoes)\s+(?:sobre|de|do|da)\s+(.+)$/,
    /^(?:(?:me )?(?:conte|explique)\s+)?(?:a )?(?:biografia|trajetoria|historia)\s+(?:de|do|da)\s+(.+)$/,
    /^(?:qual (?:e|foi)|como foi)\s+a\s+(?:trajetoria|historia)\s+(?:de|do|da)\s+(.+)$/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].replace(/^(?:o|a)\s+/, "").replace(/[, ]+por favor$/, "").trim();
      // Do not turn an unrelated follow-up, URL or instruction into an entity.
      if (name.length >= 2 && name.length <= 80 && /^[a-z -]+$/.test(name)) return name;
    }
  }
  return null;
}
function politicalSubject(message) {
  return /\b(politic[ao]s?|constituicao|constitucional|democracia|republica|poderes|executivo|judiciario|legislativo|presidente|governador|prefeito|vereador|deputad[oa]|senad[oa]r|congresso|partidos?|pec|votacao|tramitacao)\b/.test(normalizeQuestion(message));
}
module.exports = { normalizeQuestion, blockedRequest, extractPoliticalName, politicalSubject };
