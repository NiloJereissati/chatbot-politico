const axios = require("axios");

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function buscarDeputado(nomeBusca) {

  const response = await axios.get(
    "https://dadosabertos.camara.leg.br/api/v2/deputados",
    {
      timeout: 3000
    }
  );

  const deputados = response.data.dados;

  const busca = normalizarTexto(nomeBusca);

  // prioridade 1: nome completo
  let deputado = deputados.find((d) =>
    normalizarTexto(d.nome) === busca
  );

  // prioridade 2: começa com
  if (!deputado) {
    deputado = deputados.find((d) =>
      normalizarTexto(d.nome).startsWith(busca)
    );
  }

  // prioridade 3: contém
  if (!deputado) {
    deputado = deputados.find((d) =>
      normalizarTexto(d.nome).includes(busca)
    );
  }

  if (!deputado) {
    return null;
  }

  return {
    nome: deputado.nome,
    partido: deputado.siglaPartido,
    uf: deputado.siglaUf
  };
}

module.exports = {
  buscarDeputado
};