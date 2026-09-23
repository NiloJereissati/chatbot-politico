const axios = require("axios");

function normalizarTexto(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function buscarDeputado(nomeBusca) {
  const response = await axios.get(
    "https://dadosabertos.camara.leg.br/api/v2/deputados",
    { timeout: 3000 }
  );

  const busca = normalizarTexto(nomeBusca);
  const deputados = response.data.dados;

  const deputado = deputados.find((d) =>
    normalizarTexto(d.nome).includes(busca)
  );

  if (!deputado) return null;

  return {
    tipo: "Deputado federal",
    id: deputado.id,
    nome: deputado.nome,
    partido: deputado.siglaPartido,
    uf: deputado.siglaUf,
    urlFoto: deputado.urlFoto,
    source: {
      title: "Dados Abertos da Câmara dos Deputados",
      url: deputado.uri
    }
  };
}

async function buscarProjetoLei(tipo, numero, ano) {
  const response = await axios.get(
    "https://dadosabertos.camara.leg.br/api/v2/proposicoes",
    {
      timeout: 5000,
      params: {
        siglaTipo: tipo,
        numero: numero,
        ano: ano
      }
    }
  );

  const projeto = response.data.dados[0];

  if (!projeto) return null;

  let detalhes = {};
  let autores = [];

  try {
    const detalhesResponse = await axios.get(
      `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${projeto.id}`,
      { timeout: 5000 }
    );
    detalhes = detalhesResponse.data.dados || {};
  } catch {
    detalhes = {};
  }

  try {
    const autoresResponse = await axios.get(
      `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${projeto.id}/autores`,
      { timeout: 5000 }
    );
    autores = autoresResponse.data.dados || [];
  } catch {
    autores = [];
  }

  return {
    id: projeto.id,
    tipo: projeto.siglaTipo,
    numero: projeto.numero,
    ano: projeto.ano,
    ementa: projeto.ementa,
    ementaDetalhada: detalhes.ementaDetalhada,
    dataApresentacao: detalhes.dataApresentacao,
    situacao: detalhes.statusProposicao?.descricaoSituacao,
    despacho: detalhes.statusProposicao?.despacho,
    autores: autores.map((autor) => autor.nome).filter(Boolean),
    source: {
      title: "Dados Abertos da Câmara dos Deputados",
      url: projeto.uri
    }
  };
}

module.exports = {
  buscarDeputado,
  buscarProjetoLei
};
