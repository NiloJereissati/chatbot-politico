const axios = require("axios");

async function buscarDeputado(nome) {
  const res = await axios.get(
    "https://dadosabertos.camara.leg.br/api/v2/deputados",
    { params: { nome } }
  );

  const deputado = res.data.dados[0];

  if (!deputado) return null;

  return {
    nome: deputado.nome,
    partido: deputado.siglaPartido,
    uf: deputado.siglaUf
  };
}

async function buscarProjetoLei(numero) {
  const res = await axios.get(
    "https://dadosabertos.camara.leg.br/api/v2/proposicoes",
    { params: { numero } }
  );

  return res.data.dados[0] || null;
}

module.exports = {
  buscarDeputado,
  buscarProjetoLei
};