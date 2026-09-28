const TRANSPARENCIA_API_BASE_URL =
  "https://api.portaldatransparencia.gov.br/api-de-dados";

class TransparenciaTokenMissingError extends Error {
  constructor() {
    super("Portal da Transparência API token is missing.");
    this.name = "TransparenciaTokenMissingError";
  }
}

function getApiKey() {
  return (
    process.env.PORTAL_TRANSPARENCIA_API_KEY ||
    process.env.TRANSPARENCIA_API_KEY ||
    ""
  ).trim();
}

function formatDateBR(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function defaultDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 3);

  return {
    dataInicial: formatDateBR(start),
    dataFinal: formatDateBR(end),
  };
}

async function consultarPortal(path, params = {}) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new TransparenciaTokenMissingError();
  }

  const url = new URL(`${TRANSPARENCIA_API_BASE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: {
      "chave-api-dados": apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Portal da Transparência API error: ${response.status} ${body}`);
  }

  return response.json();
}

async function consultarEmendas({ ano, autor, pagina = 1 }) {
  const data = await consultarPortal("/emendas", {
    ano,
    nomeAutor: autor,
    pagina,
  });

  return {
    tipo: "Emendas parlamentares",
    ano,
    autor,
    itens: Array.isArray(data) ? data.slice(0, 5) : [],
    source: {
      title: "Portal da Transparência - Emendas parlamentares",
      url: "https://portaldatransparencia.gov.br/emendas",
    },
  };
}

async function consultarContratos({ dataInicial, dataFinal, codigoOrgao, pagina = 1 }) {
  const range = dataInicial && dataFinal ? { dataInicial, dataFinal } : defaultDateRange();
  const data = await consultarPortal("/contratos", {
    ...range,
    codigoOrgao,
    pagina,
  });

  return {
    tipo: "Contratos públicos",
    dataInicial: range.dataInicial,
    dataFinal: range.dataFinal,
    codigoOrgao,
    itens: Array.isArray(data) ? data.slice(0, 5) : [],
    source: {
      title: "Portal da Transparência - Contratos",
      url: "https://portaldatransparencia.gov.br/contratos",
    },
  };
}

async function consultarLicitacoes({ dataInicial, dataFinal, codigoOrgao, pagina = 1 }) {
  const range = dataInicial && dataFinal ? { dataInicial, dataFinal } : defaultDateRange();
  const data = await consultarPortal("/licitacoes", {
    ...range,
    codigoOrgao,
    pagina,
  });

  return {
    tipo: "Licitações",
    dataInicial: range.dataInicial,
    dataFinal: range.dataFinal,
    codigoOrgao,
    itens: Array.isArray(data) ? data.slice(0, 5) : [],
    source: {
      title: "Portal da Transparência - Licitações",
      url: "https://portaldatransparencia.gov.br/licitacoes",
    },
  };
}

module.exports = {
  TransparenciaTokenMissingError,
  consultarContratos,
  consultarEmendas,
  consultarLicitacoes,
};
