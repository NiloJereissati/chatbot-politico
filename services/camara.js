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
    nome: deputado.nome,
    partido: deputado.siglaPartido,
    uf: deputado.siglaUf
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

  return {
    tipo: projeto.siglaTipo,
    numero: projeto.numero,
    ano: projeto.ano,
    ementa: projeto.ementa
  };
}

module.exports = {
  buscarDeputado,
  buscarProjetoLei
};