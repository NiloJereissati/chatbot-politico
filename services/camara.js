const axios = require("axios");

async function buscarDeputado(nome) {

  const response = await axios.get(
    "https://dadosabertos.camara.leg.br/api/v2/deputados",
    {
      timeout: 2000
    }
  );

  const deputados = response.data.dados;

  const deputado = deputados.find((d) =>
    d.nome.toLowerCase().includes(nome.toLowerCase())
  );

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