const IBGE_BASE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades";

const cache = new Map();

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function fetchJson(url) {
  const cached = cache.get(url);

  if (cached) {
    return cached;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`IBGE API error: ${response.status}`);
  }

  const data = await response.json();
  cache.set(url, data);
  return data;
}

async function listarEstados() {
  return fetchJson(`${IBGE_BASE_URL}/estados?orderBy=nome`);
}

async function listarMunicipios() {
  return fetchJson(`${IBGE_BASE_URL}/municipios?orderBy=nome`);
}

async function listarMunicipiosPorUf(uf) {
  return fetchJson(`${IBGE_BASE_URL}/estados/${encodeURIComponent(uf)}/municipios?orderBy=nome`);
}

function mapEstado(estado) {
  return {
    tipo: "Estado",
    id: estado.id,
    nome: estado.nome,
    sigla: estado.sigla,
    regiao: estado.regiao?.nome,
    regiaoSigla: estado.regiao?.sigla,
    source: {
      title: "IBGE - API de Localidades",
      url: "https://servicodados.ibge.gov.br/api/docs/localidades",
    },
  };
}

function mapMunicipio(municipio) {
  const uf = municipio.microrregiao?.mesorregiao?.UF;
  const regiao = uf?.regiao;

  return {
    tipo: "Município",
    id: municipio.id,
    nome: municipio.nome,
    uf: uf?.sigla,
    estado: uf?.nome,
    regiao: regiao?.nome,
    regiaoSigla: regiao?.sigla,
    source: {
      title: "IBGE - API de Localidades",
      url: "https://servicodados.ibge.gov.br/api/docs/localidades",
    },
  };
}

async function buscarEstadoIBGE(nomeOuUf) {
  const busca = normalizarTexto(nomeOuUf);
  const estados = await listarEstados();
  const estado = estados.find((item) => {
    return (
      normalizarTexto(item.nome) === busca ||
      normalizarTexto(item.sigla) === busca
    );
  });

  return estado ? mapEstado(estado) : null;
}

async function buscarMunicipioIBGE(nome, uf) {
  const busca = normalizarTexto(nome);
  const municipios = uf ? await listarMunicipiosPorUf(uf) : await listarMunicipios();
  const municipio =
    municipios.find((item) => normalizarTexto(item.nome) === busca) ||
    municipios.find((item) => normalizarTexto(item.nome).includes(busca));

  return municipio ? mapMunicipio(municipio) : null;
}

async function buscarMunicipiosPorUfIBGE(uf) {
  const municipios = await listarMunicipiosPorUf(uf);
  const estado = await buscarEstadoIBGE(uf);

  return {
    tipo: "Lista de municípios",
    uf: estado?.sigla || String(uf).toUpperCase(),
    estado: estado?.nome,
    regiao: estado?.regiao,
    quantidade: municipios.length,
    exemplos: municipios.slice(0, 8).map((municipio) => municipio.nome),
    source: {
      title: "IBGE - API de Localidades",
      url: "https://servicodados.ibge.gov.br/api/docs/localidades",
    },
  };
}

module.exports = {
  buscarEstadoIBGE,
  buscarMunicipioIBGE,
  buscarMunicipiosPorUfIBGE,
};
