const axios = require("axios");

function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function calcularSimilaridade(a, b) {

  a = normalizarTexto(a);
  b = normalizarTexto(b);

  if (a === b) return 100;

  let pontos = 0;

  const palavrasA = a.split(" ");
  const palavrasB = b.split(" ");

  palavrasA.forEach((palavra) => {
    if (palavrasB.includes(palavra)) {
      pontos += 1;
    }
  });

  return pontos;
}

async function buscarDeputado(nomeBusca) {

  const response = await axios.get(
    "https://dadosabertos.camara.leg.br/api/v2/deputados",
    {
      timeout: 3000
    }
  );

  const deputados = response.data.dados;

  let melhorResultado = null;
  let maiorPontuacao = 0;

  deputados.forEach((deputado) => {

    const score = calcularSimilaridade(
      nomeBusca,
      deputado.nome
    );

    if (score > maiorPontuacao) {
      maiorPontuacao = score;
      melhorResultado = deputado;
    }
  });

  if (!melhorResultado || maiorPontuacao === 0) {
    return null;
  }

  return {
    nome: melhorResultado.nome,
    partido: melhorResultado.siglaPartido,
    uf: melhorResultado.siglaUf
  };
}

module.exports = {
  buscarDeputado
};